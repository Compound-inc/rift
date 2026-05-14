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

export function HrCreatePositionDialog() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [location, setLocation] = useState('')
  const [arrangement, setArrangement] = useState<string>('hybrid')
  const [employmentType, setEmploymentType] = useState<string>('full_time')
  const [hiringManager, setHiringManager] = useState('')
  const [compensation, setCompensation] = useState('')
  const [description, setDescription] = useState('')

  const submitDisabled =
    title.trim().length === 0 ||
    department.trim().length === 0 ||
    location.trim().length === 0

  const reset = () => {
    setTitle('')
    setDepartment('')
    setLocation('')
    setArrangement('hybrid')
    setEmploymentType('full_time')
    setHiringManager('')
    setCompensation('')
    setDescription('')
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const handleSubmit = async () => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    toast.success(`${title.trim()} added to drafts`)
    setOpen(false)
    reset()
  }

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
      description="Draft the role now, publish it when the team is aligned."
      buttonText="Create position"
      submitButtonDisabled={submitDisabled}
      handleSubmit={handleSubmit}
    >
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
              placeholder="Remote · Americas"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="position-compensation">Compensation</Label>
            <Input
              id="position-compensation"
              placeholder="$170k – $210k"
              value={compensation}
              onChange={(event) => setCompensation(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Arrangement</Label>
            <Select
              value={arrangement}
              onValueChange={(value) => setArrangement(value ?? 'hybrid')}
            >
              <SelectTrigger className="w-full" size="default">
                <SelectValue placeholder="Select arrangement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="onsite">On-site</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Employment type</Label>
            <Select
              value={employmentType}
              onValueChange={(value) => setEmploymentType(value ?? 'full_time')}
            >
              <SelectTrigger className="w-full" size="default">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full-time</SelectItem>
                <SelectItem value="part_time">Part-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="position-description">Summary</Label>
          <Textarea
            id="position-description"
            placeholder="What does this person own? What does success look like in 6 months?"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-[88px]"
          />
        </div>
      </div>
    </FormDialog>
  )
}
