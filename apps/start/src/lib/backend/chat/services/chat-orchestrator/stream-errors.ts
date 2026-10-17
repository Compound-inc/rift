/**
 * Watch the model stream for stream-level `error` parts.
 *
 * AI SDK v7's `toUIMessageStream` outcome can't be trusted for this: a
 * `finish` part sets it to `completed`, a later `error` can't change that,
 * and a `finish` after an `error` overwrites `failed` with `completed`. Its
 * `onError` formatter also runs for tool errors, which must not fail the
 * turn. Tool failures arrive as `tool-error` parts, so only `error` parts
 * count here. Parts pass through unchanged.
 */
export function observeStreamErrors<TPart extends { readonly type: string }>(
  onError: () => void,
): TransformStream<TPart, TPart> {
  return new TransformStream<TPart, TPart>({
    transform(part, controller) {
      if (part.type === 'error') onError()
      controller.enqueue(part)
    },
  })
}
