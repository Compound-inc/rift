// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useHrPositionDetailViewModel,
  useHrPositionsViewModel,
} from './hr-positions.logic'
import type {
  HrApplicationView,
  HrPositionView,
} from '@/lib/frontend/hr/recruitment'

const {
  useHrApplicationsForPositionMock,
  useHrPositionMock,
  useHrPositionsMock,
} = vi.hoisted(() => ({
  useHrApplicationsForPositionMock: vi.fn(),
  useHrPositionMock: vi.fn(),
  useHrPositionsMock: vi.fn(),
}))

vi.mock('@/lib/frontend/hr/recruitment', () => ({
  useHrApplicationsForPosition: useHrApplicationsForPositionMock,
  useHrPosition: useHrPositionMock,
  useHrPositions: useHrPositionsMock,
}))

const archivedPosition: HrPositionView = {
  id: 'pos-archived',
  title: 'Archived Designer',
  department: 'Product',
  location: 'Remote',
  arrangement: 'remote',
  employmentType: 'full_time',
  status: 'filled',
  description: 'Old search retained for candidate context.',
  hiringManager: 'Jamie',
  compensation: '$100k',
  tags: [],
  archivedAt: 1_700_000_000_000,
  createdAt: 1_690_000_000_000,
  updatedAt: 1_700_000_000_000,
}

const activePosition: HrPositionView = {
  ...archivedPosition,
  id: 'pos-open',
  title: 'Open Designer',
  status: 'open',
  archivedAt: null,
}

const applicationForArchivedPosition: HrApplicationView = {
  id: 'app-1',
  candidateId: 'candidate-1',
  positionId: archivedPosition.id,
  stage: 'advanced',
  affinityScore: 87,
  affinityRationale: 'Strong portfolio.',
  affinitySignals: null,
  affinityModel: 'test-model',
  cvAttachmentId: 'cv.pdf',
  cvText: null,
  source: 'Manual',
  aiProfileSnapshot: null,
  aiSignals: null,
  lastTransitionAt: null,
  rejectionReason: null,
  hiredAt: null,
  archivedAt: null,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
}

describe('useHrPositionDetailViewModel', () => {
  beforeEach(() => {
    useHrApplicationsForPositionMock.mockReset()
    useHrPositionMock.mockReset()
    useHrPositionsMock.mockReset()
    useHrApplicationsForPositionMock.mockReturnValue({
      applications: [applicationForArchivedPosition],
      loading: false,
    })
    useHrPositionMock.mockImplementation((positionId: string | null) => ({
      position: positionId === archivedPosition.id ? archivedPosition : null,
      loading: false,
    }))
  })

  it('loads archived Positions by id so old Applications can still link back to their lifecycle context', () => {
    render(<PositionDetailHarness positionId={archivedPosition.id} />)

    expect(useHrPositionMock).toHaveBeenCalledWith(archivedPosition.id)
    expect(screen.getByTestId('position-id').textContent).toBe(
      archivedPosition.id,
    )
    expect(screen.getByTestId('status').textContent).toBe('filled')
    expect(screen.getByTestId('applicants').textContent).toBe('1')
  })
})

describe('useHrPositionsViewModel', () => {
  beforeEach(() => {
    useHrApplicationsForPositionMock.mockReset()
    useHrPositionMock.mockReset()
    useHrPositionsMock.mockReset()
    useHrPositionsMock.mockReturnValue({
      positions: [archivedPosition, activePosition],
      loading: false,
    })
  })

  it('forwards the archive filter for the archived tab without making archived rows count as open dashboard work', () => {
    render(<PositionsHarness archiveFilter="archived" />)

    expect(useHrPositionsMock).toHaveBeenCalledWith({
      archiveFilter: 'archived',
    })
    expect(screen.getByTestId('position-count').textContent).toBe('2')
    expect(screen.getByTestId('open-stat').textContent).toBe('1')
  })
})

function PositionDetailHarness({
  positionId,
}: {
  readonly positionId: string
}) {
  const viewModel = useHrPositionDetailViewModel(positionId)
  return (
    <div>
      <output data-testid="position-id">
        {viewModel.position?.id ?? 'missing'}
      </output>
      <output data-testid="status">
        {viewModel.position?.status ?? 'missing'}
      </output>
      <output data-testid="applicants">
        {viewModel.position?.applicants ?? 'missing'}
      </output>
    </div>
  )
}

function PositionsHarness({
  archiveFilter,
}: {
  readonly archiveFilter: 'active' | 'archived' | 'all'
}) {
  const viewModel = useHrPositionsViewModel({ archiveFilter })
  const openStat = viewModel.stats.find((stat) => stat.id === 'open')
  return (
    <div>
      <output data-testid="position-count">{viewModel.positions.length}</output>
      <output data-testid="open-stat">{openStat?.value ?? 'missing'}</output>
    </div>
  )
}
