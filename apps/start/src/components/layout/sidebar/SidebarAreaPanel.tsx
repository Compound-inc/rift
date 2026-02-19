import { cn } from '@rift/utils'
import type { SidebarNavAreaConfig, SidebarNavAreas, SidebarNavData } from './app-sidebar-nav.config'
import { SidebarNavItem } from './SidebarNavItem'

/**
 * Renders the area panel from config.
 * One Area per key; only the currentArea is visible. Each area has title + sections.
 */
export function SidebarAreaPanel({
  areas,
  currentArea,
  data,
}: {
  areas: SidebarNavAreas
  currentArea: string | null
  data: SidebarNavData
}) {
  return (
    <div className="relative w-full grow overflow-hidden">
      {Object.entries(areas).map(([areaKey, areaFn]) => {
        const config = areaFn(data)
        return (
          <Area
            key={areaKey}
            visible={areaKey === currentArea}
            direction="right"
            config={config}
            data={data}
          />
        )
      })}
    </div>
  )
}

function Area({
  visible,
  direction,
  config,
  data,
}: {
  visible: boolean
  direction: 'left' | 'right'
  config: SidebarNavAreaConfig
  data: SidebarNavData
}) {
  const { title, content } = config
  return (
    <div
      className={cn(
        'left-0 top-0 flex size-full flex-col',
        visible
          ? 'relative opacity-100'
          : cn(
              'pointer-events-none absolute inset-0 opacity-0',
              direction === 'left' ? '-translate-x-full' : 'translate-x-full',
            ),
      )}
      aria-hidden={!visible ? 'true' : undefined}
    >
      {title ? (
        <div className="mb-2 flex items-center gap-3 px-3 py-2">
          <span className="text-lg font-semibold text-content-emphasis">
            {title}
          </span>
        </div>
      ) : null}
      <div className="flex flex-col gap-8">
        {content.map((section, idx) => (
          <div key={idx} className="flex flex-col gap-0.5">
            {section.name ? (
              <div className="mb-2 pl-3 text-sm text-content-muted">
                {section.name}
              </div>
            ) : null}
            {section.items.map((item) => (
              <SidebarNavItem
                key={item.name}
                item={item}
                pathname={data.pathname}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
