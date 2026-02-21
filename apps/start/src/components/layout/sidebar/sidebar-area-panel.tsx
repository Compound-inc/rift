import { cn } from '@rift/utils'
import type { SidebarNavAreaConfig, SidebarNavAreas, SidebarNavData } from './app-sidebar-nav.config'
import { SidebarAreaLayout } from './sidebar-area-layout'

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
  const { ContentComponent, title, content } = config
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
      {ContentComponent ? (
        <ContentComponent pathname={data.pathname} />
      ) : (
        <SidebarAreaLayout
          title={title}
          sections={content}
          pathname={data.pathname}
        />
      )}
    </div>
  )
}
