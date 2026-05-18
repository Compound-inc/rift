'use client'

import { useState } from 'react'
import { Button } from '@rift/ui/button'
import { FormDialog } from '@rift/ui/dialog'
import { Input } from '@rift/ui/input'
import { Label } from '@rift/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rift/ui/select'
import { Textarea } from '@rift/ui/textarea'
import { toast } from 'sonner'
import Plus from 'lucide-react/dist/esm/icons/plus'
import { createPosition } from '@/lib/frontend/hr/recruitment'
import type {
  HrPositionEmploymentType,
  HrPositionWorkArrangement,
} from '@/lib/shared/hr/recruitment'
import { getArrangementLabel, getEmploymentTypeLabel } from './hr-positions.logic'

type CreationStep = 'general' | 'details'

const EMPLOYMENT_TYPE_OPTIONS: readonly HrPositionEmploymentType[] = [
  'full_time',
  'part_time',
  'contract',
  'internship',
]

const ARRANGEMENT_OPTIONS: readonly HrPositionWorkArrangement[] = [
  'remote',
  'hybrid',
  'onsite',
]

function formatCompensation(value: string) {
  const range = value.trim()
  if (!range) return undefined
  return `$ ${range}`
}

function buildPositionDescription(input: {
  readonly summary: string
  readonly yearsOfExperience: string
  readonly goals: string
  readonly tasks: string
  readonly mustHaves: string
  readonly additionalContext: string
}) {
  const sections = [
    ['Summary', input.summary],
    ['Target years of experience', input.yearsOfExperience],
    ['Goals and success outcomes', input.goals],
    ['Day-to-day tasks', input.tasks],
    ['Must-have context', input.mustHaves],
    ['Additional context for AI screening', input.additionalContext],
  ] as const

  /**
   * Position description is the persisted AI context source today. Keeping the
   * wizard's structured answers as labelled sections makes the prompt readable
   * without requiring a schema migration for every new recruiting question.
   */
  return sections
    .map(([label, value]) => [label, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `${label}:\n${value}`)
    .join('\n\n')
}

export function HrCreatePositionDialog({
  onCreated,
}: {
  onCreated?: (positionId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<CreationStep>('general')
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [location, setLocation] = useState('')
  const [arrangement, setArrangement] =
    useState<HrPositionWorkArrangement>('hybrid')
  const [employmentType, setEmploymentType] =
    useState<HrPositionEmploymentType>('full_time')
  const [hiringManager, setHiringManager] = useState('')
  const [salaryRange, setSalaryRange] = useState('')
  const [summary, setSummary] = useState('')
  const [yearsOfExperience, setYearsOfExperience] = useState('')
  const [goals, setGoals] = useState('')
  const [tasks, setTasks] = useState('')
  const [mustHaves, setMustHaves] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const generalStepComplete =
    title.trim().length > 0 &&
    department.trim().length > 0 &&
    location.trim().length > 0

  const detailsStepComplete =
    summary.trim().length > 0 ||
    yearsOfExperience.trim().length > 0 ||
    goals.trim().length > 0 ||
    tasks.trim().length > 0 ||
    mustHaves.trim().length > 0 ||
    additionalContext.trim().length > 0

  const submitDisabled =
    submitting ||
    (step === 'general' ? !generalStepComplete : !detailsStepComplete)

  const reset = () => {
    setStep('general')
    setTitle('')
    setDepartment('')
    setLocation('')
    setArrangement('hybrid')
    setEmploymentType('full_time')
    setHiringManager('')
    setSalaryRange('')
    setSummary('')
    setYearsOfExperience('')
    setGoals('')
    setTasks('')
    setMustHaves('')
    setAdditionalContext('')
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const handleSubmit = async () => {
    if (step === 'general') {
      setStep('details')
      return
    }

    setSubmitting(true)
    try {
      const description = buildPositionDescription({
        summary,
        yearsOfExperience,
        goals,
        tasks,
        mustHaves,
        additionalContext,
      })
      const created = await createPosition({
        data: {
          title: title.trim(),
          department: department.trim(),
          location: location.trim(),
          arrangement,
          employmentType,
          status: 'open',
          hiringManager: hiringManager.trim() || undefined,
          compensation: formatCompensation(salaryRange),
          description: description || undefined,
          tags: [
            department.trim().toLowerCase(),
            arrangement,
            employmentType,
          ].filter(Boolean),
        },
      })
      toast.success(`${created.title} added.`)
      onCreated?.(created.id)
      setOpen(false)
      reset()
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : 'Failed to create position.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const stepLabel = step === 'general' ? 'Step 1 of 2' : 'Step 2 of 2'

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button variant="default">
          <Plus aria-hidden />
          New position
        </Button>
      }
      title="Open a new position"
      description={
        step === 'general'
          ? 'Start with the role basics your team needs to align on.'
          : 'Add the screening context the AI should use when reviewing candidates.'
      }
      buttonText={
        step === 'general'
          ? 'Continue to details'
          : submitting
            ? 'Creating…'
            : 'Create position'
      }
      secondaryButtonText={step === 'details' ? 'Back' : undefined}
      onSecondaryClick={() => setStep('general')}
      submitButtonDisabled={submitDisabled}
      secondaryButtonDisabled={submitting}
      handleSubmit={handleSubmit}
      helpText={<p className="text-foreground-tertiary">{stepLabel}</p>}
    >
      {step === 'general' ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="position-title">Title</Label>
            <Input
              id="position-title"
              placeholder="Senior Product Engineer"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="position-department">Department</Label>
              <Input
                id="position-department"
                placeholder="Engineering"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="position-hiring-manager">Hiring manager</Label>
              <Input
                id="position-hiring-manager"
                placeholder="Priya Shah"
                value={hiringManager}
                onChange={(event) => setHiringManager(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="position-location">Location</Label>
              <Input
                id="position-location"
                placeholder="Remote, Americas"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Arrangement</Label>
              <Select
                value={arrangement}
                onValueChange={(value) =>
                  setArrangement((value as HrPositionWorkArrangement) ?? 'hybrid')
                }
              >
                <SelectTrigger className="w-full" size="default">
                  <SelectValue placeholder="Select arrangement">
                    {getArrangementLabel(arrangement)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ARRANGEMENT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {getArrangementLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="position-salary-range">Salary range</Label>
              <div className="flex h-9 items-center rounded-md border border-border-base bg-transparent px-3 text-base transition-colors focus-within:border-foreground-tertiary focus-within:ring-3 focus-within:ring-foreground-tertiary/50 md:text-sm">
                <span className="shrink-0 text-foreground-secondary" aria-hidden>
                  $
                </span>
                <Input
                  id="position-salary-range"
                  inputMode="text"
                  placeholder="100,000 - 120,000"
                  value={salaryRange}
                  onChange={(event) => setSalaryRange(event.target.value)}
                  className="h-7 border-0 px-2 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Employment type</Label>
              <Select
                value={employmentType}
                onValueChange={(value) =>
                  setEmploymentType(
                    (value as HrPositionEmploymentType) ?? 'full_time',
                  )
                }
              >
                <SelectTrigger className="w-full" size="default">
                  <SelectValue placeholder="Select type">
                    {getEmploymentTypeLabel(employmentType)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {getEmploymentTypeLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="position-summary">Role summary</Label>
            <Textarea
              id="position-summary"
              placeholder="What does this person own? What problems should they solve first?"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              className="min-h-[84px]"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="position-experience">Years of experience</Label>
            <Input
              id="position-experience"
              placeholder="5+ years building production SaaS products"
              value={yearsOfExperience}
              onChange={(event) => setYearsOfExperience(event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="position-goals">Goals</Label>
              <Textarea
                id="position-goals"
                placeholder="Success signals for the first 90 days and 6 months."
                value={goals}
                onChange={(event) => setGoals(event.target.value)}
                className="min-h-[104px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="position-tasks">Tasks</Label>
              <Textarea
                id="position-tasks"
                placeholder="The work they will do weekly."
                value={tasks}
                onChange={(event) => setTasks(event.target.value)}
                className="min-h-[104px]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="position-must-haves">Must-haves</Label>
            <Textarea
              id="position-must-haves"
              placeholder="Skills, domain context, language needs, seniority signals."
              value={mustHaves}
              onChange={(event) => setMustHaves(event.target.value)}
              className="min-h-[84px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="position-ai-context">Additional AI context</Label>
            <Textarea
              id="position-ai-context"
              placeholder="Anything that should affect fit decisions, tradeoffs, or disqualifiers."
              value={additionalContext}
              onChange={(event) => setAdditionalContext(event.target.value)}
              className="min-h-[84px]"
            />
          </div>
        </div>
      )}
    </FormDialog>
  )
}
