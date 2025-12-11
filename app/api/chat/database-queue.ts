import { Chunk, Effect, Fiber, Queue, Ref } from "effect";

import { DatabaseError } from "./errors";
import {
  CONFIG,
  databaseRetrySchedule,
  isRetryableDatabaseError,
  logger,
  type LogContext,
} from "./services";

interface DatabaseOperation {
  operation: Effect.Effect<void, DatabaseError>;
  name: string;
}

export const createDatabaseQueue = (logContext: LogContext) =>
  Effect.gen(function* () {
    const queue = yield* Queue.unbounded<DatabaseOperation>();
    const isShutdown = yield* Ref.make(false);

    const shouldRetryOperation = (name: string) => name !== "appendMessageDelta";

    const processOperation = (op: DatabaseOperation) => {
      const base = op.operation.pipe(
        // Normalize to DatabaseError for consistent retry predicates
        Effect.mapError(
          (error) =>
            error instanceof DatabaseError
              ? error
              : new DatabaseError({
                  message: `Database operation failed: ${op.name}`,
                  operation: op.name,
                  cause: error,
                })
        )
      );

      const withPolicy = shouldRetryOperation(op.name)
        ? base.pipe(
            Effect.retry({
              schedule: databaseRetrySchedule,
              while: isRetryableDatabaseError,
            }),
            Effect.tapError((error) =>
              Effect.sync(() => {
                logger.error(
                  `Database operation failed after retries: ${op.name}`,
                  logContext,
                  error
                );
              })
            )
          )
        : base.pipe(
            // Append deltas: no retries, just log and continue
            Effect.tapError((error) =>
              Effect.sync(() => {
                logger.error(
                  `Database operation failed (no retry): ${op.name}`,
                  logContext,
                  error
                );
              })
            )
          );

      // Swallow errors so the processor keeps draining
      return withPolicy.pipe(Effect.catchAll(() => Effect.void));
    };

    // Use daemon fiber so it stays alive beyond the request scope
    const processorFiber = yield* Effect.forkDaemon(
      Effect.gen(function* () {
        while (true) {
          const shutdown = yield* Ref.get(isShutdown);
          if (shutdown) {
            const remaining = yield* Queue.takeAll(queue);
            const remainingArray = Chunk.toArray(remaining);
            if (remainingArray.length > 0) {
              logger.debug(`Draining ${remainingArray.length} pending operations`, logContext);
            }
            yield* Effect.all(
              remainingArray.map((op: DatabaseOperation) => processOperation(op)),
              { concurrency: CONFIG.DRAIN_CONCURRENCY }
            );
            break;
          }
          const op = yield* Queue.take(queue);
          yield* processOperation(op);
        }
      })
    );

    const enqueue = (operation: Effect.Effect<void, DatabaseError>, name: string) =>
      Queue.offer(queue, { operation, name }).pipe(Effect.asVoid);

    const shutdown = Effect.gen(function* () {
      yield* Ref.set(isShutdown, true);
      yield* Queue.offer(queue, {
        operation: Effect.void,
        name: "shutdown-signal",
      });
      yield* Fiber.await(processorFiber);
    });

    return { enqueue, shutdown };
  });


