import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';
import { initBotId } from 'botid/client/core';

const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  initBotId({
    protect: [
      {
        path: '/api/chat',
        method: 'POST',
      },
      {
        path: '/api/generate-title',
        method: 'POST',
      },
    ],
  });

  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: '/relay-7ls5/',
      ui_host: 'https://us.posthog.com',
      defaults: '2025-05-24',
    });
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
