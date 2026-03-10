import { describe, expect, it } from 'vitest'
import { isAdminRole } from './roles'

describe('isAdminRole', () => {
  it('allows owners and admins', () => {
    expect(isAdminRole('owner')).toBe(true)
    expect(isAdminRole('admin')).toBe(true)
    expect(isAdminRole('member,admin')).toBe(true)
  })

  it('rejects non-admin roles', () => {
    expect(isAdminRole('member')).toBe(false)
    expect(isAdminRole('viewer')).toBe(false)
  })
})
