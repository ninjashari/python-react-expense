import { z } from "zod";

export const emailSchema = z.string().email().max(255).toLowerCase().trim();
export const passwordSchema = z.string().min(8).max(100);

export const registerSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(100),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(100),
    newPassword: passwordSchema,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "New password must be different from the current one",
    path: ["newPassword"],
  });

export const accountTypeValues = [
  "checking",
  "savings",
  "credit",
  "cash",
  "investment",
  "ppf",
] as const;

export const accountStatusValues = ["active", "inactive", "closed"] as const;

const money = z
  .union([z.number(), z.string()])
  .transform((v) => Number(v))
  .pipe(z.number().finite());

const optionalMoney = money.optional().nullable();
const dayOfMonth = z.number().int().min(1).max(31).optional().nullable();

export const accountSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  type: z.enum(accountTypeValues),
  balance: money.default(0),
  accountNumber: z.string().max(64).optional().nullable(),
  cardNumber: z.string().regex(/^\d{4}$/).optional().nullable(),
  cardExpiryMonth: z.number().int().min(1).max(12).optional().nullable(),
  cardExpiryYear: z.number().int().min(2000).max(2100).optional().nullable(),
  creditLimit: optionalMoney,
  billGenerationDate: dayOfMonth,
  paymentDueDate: dayOfMonth,
  interestRate: optionalMoney,
  status: z.enum(accountStatusValues).default("active"),
  openingDate: z.string().optional().nullable(),
  currency: z.string().length(3).default("INR"),
});

export const accountUpdateSchema = accountSchema.partial();

export const transactionTypeValues = ["income", "expense", "transfer"] as const;

export const transactionSchema = z
  .object({
    accountId: z.string().uuid(),
    toAccountId: z.string().uuid().optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    payeeId: z.string().uuid().optional().nullable(),
    amount: money.pipe(z.number().positive()),
    type: z.enum(transactionTypeValues),
    description: z.string().max(2000).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    date: z.string(),
    rewardPoints: optionalMoney,
  })
  .refine((d) => d.type !== "transfer" || !!d.toAccountId, {
    message: "Transfers require a destination account",
    path: ["toAccountId"],
  })
  .refine((d) => d.type !== "transfer" || d.toAccountId !== d.accountId, {
    message: "Cannot transfer to the same account",
    path: ["toAccountId"],
  });

export const transactionUpdateSchema = z.object({
  accountId: z.string().uuid().optional(),
  toAccountId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  payeeId: z.string().uuid().optional().nullable(),
  amount: money.pipe(z.number().positive()).optional(),
  type: z.enum(transactionTypeValues).optional(),
  description: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  date: z.string().optional(),
  rewardPoints: optionalMoney,
});

export const taxonomySchema = z.object({
  name: z.string().min(1).max(160).trim(),
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
    .optional(),
});

export const taxonomyUpdateSchema = taxonomySchema.partial();

export const redemptionSchema = z.object({
  points: money.pipe(z.number().positive()),
  description: z.string().max(500).optional().nullable(),
  date: z.string(),
});

const bulkIds = z.array(z.string().uuid()).min(1).max(500);

export const bulkTransactionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), ids: bulkIds }),
  z.object({
    action: z.literal("categorize"),
    ids: bulkIds,
    categoryId: z.string().uuid().nullable(),
  }),
  z.object({
    action: z.literal("setPayee"),
    ids: bulkIds,
    payeeId: z.string().uuid().nullable(),
  }),
]);

export type AccountInput = z.infer<typeof accountSchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type RedemptionInput = z.infer<typeof redemptionSchema>;
