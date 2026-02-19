/**
 * Shared nav utilities. Used by area nav configs for:
 * - Link active state (highlight selected item)
 * - Area panel visibility (show panel for base path and all subpaths)
 */

/**
 * Returns true if pathname matches the area's base path(s) or any subpath.
 * Used to determine which sidebar panel to show.
 */
export function isAreaPath(
  pathname: string,
  basePaths: string | readonly string[],
): boolean {
  const paths = Array.isArray(basePaths) ? basePaths : [basePaths]
  return paths.some((p) => {
    if (p === '/') return pathname === '/'
    return pathname === p || pathname.startsWith(p + '/')
  })
}

/**
 * Returns true if a nav link should be active. Used by SidebarNavItem when
 * no custom isActive is provided. Prefer the `exact` prop on items instead.
 */
export function isPathActive(
  pathname: string,
  href: string,
  exact?: boolean,
): boolean {
  const base = href.split('?')[0]
  if (exact) return pathname === base
  return pathname === base || pathname.startsWith(base + '/')
}
