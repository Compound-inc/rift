'use client';
import { createStore } from 'zustand/vanilla';
import type { StateCreator } from 'zustand';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatState, ChatStatus, UIMessage } from 'ai';
import { throttle } from '@/lib/stores/throttle';

export interface BaseChatStoreState<UI_MESSAGE extends UIMessage>
  extends ChatState<UI_MESSAGE> {
  id: string | undefined;
  // Throttled messages cache
  _throttledMessages: UI_MESSAGE[] | null;
  currentChatHelpers: Pick<
    UseChatHelpers<UI_MESSAGE>,
    'stop' | 'sendMessage' | 'regenerate'
  > | null;

  // Actions
  setId: (id: string | undefined) => void;

  setMessages: (messages: UI_MESSAGE[]) => void;
  getMessageIds: () => string[];
  getLastMessageId: () => string | null;

  setStatus: (status: ChatStatus) => void;
  setError: (error: Error | undefined) => void;
  setNewChat: (id: string, messages: UI_MESSAGE[]) => void;
  setCurrentChatHelpers: (
    helpers: Pick<
      UseChatHelpers<UI_MESSAGE>,
      'stop' | 'sendMessage' | 'regenerate'
    >,
  ) => void;

  // Getters
  getThrottledMessages: () => UI_MESSAGE[];

  // Effects
  registerThrottledMessagesEffect: (effect: () => void) => () => void;
  triggerThrottledUpdate: () => void;
}

export function createBaseStateCreator<UI_MESSAGE extends UIMessage>(
  initialMessages: UI_MESSAGE[] = [],
): StateCreator<BaseChatStoreState<UI_MESSAGE>, [], []> {
  return (set, get) => {
    const MESSAGES_THROTTLE_MS = 0;
    const throttledEffects = new Set<() => void>();
    let throttledMessagesUpdater: (() => void) | null = null;
    if (!throttledMessagesUpdater) {
      throttledMessagesUpdater = throttle(() => {
        console.log('executing throttledMessagesUpdater');
        const state = get();
        set({ _throttledMessages: [...state.messages] });
        throttledEffects.forEach((cb) => {
          try {
            cb();
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[chat-store-base] throttled effect error', err);
          }
        });
      }, MESSAGES_THROTTLE_MS);
    }
    return {
      id: undefined,
      messages: initialMessages,
      status: 'ready',
      error: undefined,
      currentChatHelpers: null,
      _throttledMessages: [...initialMessages],
      setId: (id) => {
        set({ id });
      },
      setMessages: (messages) => {
        set({ messages: [...messages] });
        throttledMessagesUpdater();
      },
      setStatus: (status) => {
        set({ status });
      },
      setError: (error) => {
        set({ error });
      },
      setNewChat: (id, messages) => {
        set({ id, messages: [...messages], status: 'ready', error: undefined });
        throttledMessagesUpdater();
      },
      setCurrentChatHelpers: (helpers) => {
        set({ currentChatHelpers: helpers });
      },
      getThrottledMessages: () => {
        const state = get();
        return state._throttledMessages || state.messages;
      },
      getMessageIds: () => {
        const state = get();
        return (state._throttledMessages || state.messages).map((m) => m.id);
      },
      getLastMessageId: () => {
        const state = get();
        const messages = state._throttledMessages || state.messages;
        return messages.length > 0 ? messages[messages.length - 1].id : null;
      },
      registerThrottledMessagesEffect: (effect: () => void) => {
        throttledEffects.add(effect);
        return () => throttledEffects.delete(effect);
      },
      triggerThrottledUpdate: () => {
        throttledMessagesUpdater();
      },
      pushMessage: (message) => {
        set((state) => ({ messages: [...state.messages, message] }));
        throttledMessagesUpdater();
      },
      popMessage: () => {
        set((state) => ({ messages: state.messages.slice(0, -1) }));
        throttledMessagesUpdater();
      },
      snapshot: <T,>(value: T): T => structuredClone(value),
      replaceMessage: (index, message) => {
        set((state) => ({
          messages: [
            ...state.messages.slice(0, index),
            structuredClone(message),
            ...state.messages.slice(index + 1),
          ],
        }));
        throttledMessagesUpdater();
      },
    };
  };
}

export function createBaseStore<UI_MESSAGE extends UIMessage>(
  initialMessages: UI_MESSAGE[] = [],
) {
  return createStore<BaseChatStoreState<UI_MESSAGE>>()(
    createBaseStateCreator<UI_MESSAGE>(initialMessages),
  );
}

export type BaseSC<UM extends UIMessage> = StateCreator<
  BaseChatStoreState<UM>,
  [],
  []
>;
