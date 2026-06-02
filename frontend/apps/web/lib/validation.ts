import { z } from 'zod'

const loginFormSchema = z.object({
  username: z.string().min(6),
  password: z.string().min(8)
})

const registerFormSchema = z
  .object({
    username: z.string().min(6),
    email: z.string().email(),
    code: z.string().length(6),
    password: z.string().min(8),
    passwordRetype: z.string().min(8)
  })
  .refine((data) => data.password === data.passwordRetype, {
    message: 'Passwords are not matching',
    path: ['passwordRetype']
  })

const profileFormSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional()
})

const deleteAccountFormSchema = z
  .object({
    username: z.string().min(6),
    usernameCurrent: z.string().min(6).optional()
  })
  .passthrough()
  .refine((data) => data.username === data.usernameCurrent, {
    message: 'Username is not matching',
    path: ['username']
  })

const changePasswordFormSchema = z
  .object({
    password: z.string().min(8),
    passwordNew: z.string().min(8),
    passwordRetype: z.string().min(8)
  })
  .refine((data) => data.passwordNew !== data.password, {
    message: 'Both new and current passwords are same',
    path: ['passwordNew']
  })
  .refine((data) => data.passwordNew === data.passwordRetype, {
    message: 'Passwords are not matching',
    path: ['passwordRetype']
  })

const taskFormSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['high', 'medium', 'low']),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional()
})

const tagFormSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
})

export {
  changePasswordFormSchema,
  deleteAccountFormSchema,
  loginFormSchema,
  profileFormSchema,
  registerFormSchema,
  tagFormSchema,
  taskFormSchema
}
