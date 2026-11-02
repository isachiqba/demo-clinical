import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'

const render = async (props: Record<string, unknown>): Promise<string> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/book/:step?', name: 'book', component: { template: '<div/>' } }
    ]
  })
  const app = createSSRApp({ render: () => h(AppButton, props, () => 'Label') })
  app.use(router)
  await router.push('/')
  await router.isReady()
  return renderToString(app)
}

describe('AppButton', () => {
  it('renders a real link, with an href, when given a route', async () => {
    const html = await render({ to: { name: 'book', query: { location: 'westside' } } })
    expect(html).toContain('<a')
    expect(html).toContain('href="/book?location=westside"')
  })

  it('renders an anchor for an external href', async () => {
    const html = await render({ href: 'tel:5550142200' })
    expect(html).toContain('href="tel:5550142200"')
  })

  it('renders a button otherwise, and marks a disabled one', async () => {
    expect(await render({})).toContain('<button')
    const html = await render({ disabled: true })
    expect(html).toContain('disabled')
    expect(html).toContain('aria-disabled="true"')
  })

  it('marks a loading button as busy', async () => {
    const html = await render({ loading: true })
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('btn__spinner')
  })
})
