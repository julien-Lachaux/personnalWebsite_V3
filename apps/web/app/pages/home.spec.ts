import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearNuxtData, useRuntimeConfig } from '#imports';

import HomePage from '../components/home/HomePage.vue';
import IndexPage from './index.vue';

// Page d'accueil (lot F3a) : `/` et `/en` rendent la page réelle (`HomePage`, testée à part).

let saved: { contactEmail: string; cvSource: string };

beforeEach(() => {
  const config = useRuntimeConfig();
  saved = { contactEmail: config.public.contactEmail, cvSource: config.cvSource };
  config.public.contactEmail = 'contact@example.org';
  config.cvSource = 'fixtures';
  clearNuxtData();
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  vi.spyOn(window, 'matchMedia').mockImplementation(
    () =>
      ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
});

afterEach(() => {
  const config = useRuntimeConfig();
  config.public.contactEmail = saved.contactEmail;
  config.cvSource = saved.cvSource;
  clearNuxtData();
  vi.restoreAllMocks();
});

describe('page d’accueil', () => {
  it('rend HomePage : la coquille et le CV de la langue', async () => {
    const wrapper = await mountSuspended(IndexPage, { route: '/' });

    expect(wrapper.findComponent(HomePage).exists()).toBe(true);
    expect(wrapper.get('h1').text()).toBe('Développeur full-stack');
    expect(wrapper.get('main').attributes('id')).toBe('contenu');
  });
});
