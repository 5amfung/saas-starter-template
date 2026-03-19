import { createServerFn } from "@tanstack/react-start"
import * as z from "zod"
import {
  queryDashboardMetrics,
  queryMauChartData,
  querySignupChartData,
  requireAdmin,
} from "@/admin/admin.server"

// --- Dashboard Metrics ---

export const getAdminDashboardMetrics = createServerFn()
  .inputValidator(z.object({ timezoneOffset: z.number() }))
  .handler(async ({ data }) => {
    await requireAdmin()
    return queryDashboardMetrics(data.timezoneOffset)
  })

// --- Signup Chart ---

export const getSignupChartData = createServerFn()
  .inputValidator(
    z.object({ days: z.number().int().min(1), timezoneOffset: z.number() })
  )
  .handler(async ({ data }) => {
    await requireAdmin()
    return querySignupChartData(data.days, data.timezoneOffset)
  })

// --- MAU Chart ---

export const getMauChartData = createServerFn()
  .inputValidator(
    z.object({ days: z.number().int().min(1), timezoneOffset: z.number() })
  )
  .handler(async ({ data }) => {
    await requireAdmin()
    return queryMauChartData(data.days, data.timezoneOffset)
  })
