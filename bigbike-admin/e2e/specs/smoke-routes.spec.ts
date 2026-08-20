import { test, expect, expectRuntimeClean, resetCollectors } from '../fixtures/admin-test'
import { navigateSpa, auditScreen } from '../utils/quality'
import { LIST_ROUTES, CREATE_ROUTES, type AdminRoute } from '../utils/routes'

/**
 * Route smoke: one test per nav group. Each walks its routes via in-app SPA
 * navigation (≈1 refresh per test) and audits every screen (shell intact,
 * active nav, no error panel, no overflow/overlap, runtime + network clean).
 * Per-route failures are aggregated so one broken screen doesn't hide others.
 */
const GROUPS = ['sales', 'products', 'content', 'reports', 'system'] as const

for (const group of GROUPS) {
  const routes = LIST_ROUTES.filter((r) => r.group === group)

  test(`smoke · ${group} screens load cleanly`, async ({ adminPage, collect }) => {
    const issues: string[] = []

    for (const route of routes) {
      await test
        .step(`${route.id} (${route.path})`, async () => {
          resetCollectors(collect)
          await navigateSpa(adminPage, route.path)
          await auditScreen(adminPage, route)
          expectRuntimeClean(collect)
        })
        .catch((e: Error) =>
          issues.push(`✗ ${route.id}: ${e.message.split('\n').slice(0, 4).join(' ⏎ ')}`),
        )
    }

    expect(issues, `Screens with problems in "${group}":\n${issues.join('\n')}`).toEqual([])
  })
}

test('smoke · create/new forms render', async ({ adminPage, collect }) => {
  const issues: string[] = []
  for (const route of CREATE_ROUTES as AdminRoute[]) {
    await test
      .step(`${route.id} (${route.path})`, async () => {
        resetCollectors(collect)
        await navigateSpa(adminPage, route.path)
        await auditScreen(adminPage, route)
        // A create form should expose at least one input/select control.
        const fields = await adminPage
          .locator(
            '.bb-page-content input, .bb-page-content textarea, .bb-page-content [role="combobox"], .bb-page-content select',
          )
          .count()
        expect(fields, `${route.id}: no form fields rendered`).toBeGreaterThan(0)
        expectRuntimeClean(collect)
      })
      .catch((e: Error) => issues.push(`✗ ${route.id}: ${e.message.split('\n')[0]}`))
  }
  expect(issues, `Create forms with problems:\n${issues.join('\n')}`).toEqual([])
})
