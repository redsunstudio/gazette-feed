import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { GoogleAuth } from 'google-auth-library'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '387402170'
const SHOW_REVENUE = process.env.SHOW_REVENUE === 'true'

let _ga4Client = null
const _cache = {}
const CACHE_TTL = 300 // 5 minutes

function getGA4Client() {
  if (_ga4Client) return _ga4Client

  try {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON

    if (serviceAccountJson) {
      const credentials = JSON.parse(serviceAccountJson)
      const auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/analytics.readonly']
      })
      _ga4Client = new BetaAnalyticsDataClient({ auth })
    } else {
      _ga4Client = new BetaAnalyticsDataClient()
    }
  } catch (error) {
    console.error('Error initializing GA4 client:', error)
    throw error
  }

  return _ga4Client
}

function cacheGet(key) {
  const entry = _cache[key]
  if (entry && Date.now() - entry.ts < CACHE_TTL * 1000) {
    return entry.data
  }
  return null
}

function cacheSet(key, data) {
  _cache[key] = { data, ts: Date.now() }
}

function formatYearMonth(ym) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  try {
    const monthIdx = parseInt(ym.substring(4, 6)) - 1
    return `${months[monthIdx]} ${ym.substring(2, 4)}`
  } catch (error) {
    return ym
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date') || '2020-01-01'
    const endDate = searchParams.get('end_date') || 'today'

    // Check cache
    const cacheKey = `${startDate}:${endDate}`
    const cached = cacheGet(cacheKey)
    if (cached) {
      return Response.json(cached)
    }

    const client = getGA4Client()
    const property = `properties/${GA4_PROPERTY_ID}`

    // Query 1: Conversions by month + event
    const conversionRequest = {
      property,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'yearMonth' },
        { name: 'eventName' }
      ],
      metrics: [
        { name: 'eventCount' },
        { name: 'eventValue' }
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: ['Monthly subscription', 'Annual subscription', 'Purchase', 'purchase']
          }
        }
      },
      orderBys: [{
        dimension: {
          dimensionName: 'yearMonth'
        }
      }],
      limit: 1000
    }

    // Query 2: Source breakdown
    const sourceRequest = {
      property,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'sessionDefaultChannelGroup' },
        { name: 'eventName' }
      ],
      metrics: [
        { name: 'eventCount' },
        { name: 'eventValue' }
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: ['Monthly subscription', 'Annual subscription', 'Purchase', 'purchase']
          }
        }
      },
      limit: 1000
    }

    // Query 3: Traffic by month
    const trafficRequest = {
      property,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'yearMonth' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{
        dimension: {
          dimensionName: 'yearMonth'
        }
      }],
      limit: 1000
    }

    // Query 4: Channel breakdown
    const channelRequest = {
      property,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' }
      ],
      orderBys: [{
        metric: {
          metricName: 'sessions'
        },
        desc: true
      }],
      limit: 50
    }

    // Execute all queries in parallel
    const [convResponse, srcResponse, trafResponse, chanResponse] = await Promise.all([
      client.runReport(conversionRequest),
      client.runReport(sourceRequest),
      client.runReport(trafficRequest),
      client.runReport(channelRequest)
    ])

    // Process conversions → KPIs + trend
    const kpis = { monthly: 0, annual: 0, purchases: 0, revenue: 0.0 }
    const trend = {}

    if (convResponse[0].rows) {
      for (const row of convResponse[0].rows) {
        const ym = row.dimensionValues[0].value
        const event = row.dimensionValues[1].value
        const count = parseInt(row.metricValues[0].value)
        const value = parseFloat(row.metricValues[1].value)

        if (!trend[ym]) {
          trend[ym] = { monthly: 0, annual: 0, purchase: 0 }
        }

        if (event === 'Monthly subscription') {
          kpis.monthly += count
          trend[ym].monthly += count
        } else if (event === 'Annual subscription') {
          kpis.annual += count
          trend[ym].annual += count
        } else if (event === 'Purchase' || event === 'purchase') {
          kpis.purchases += count
          trend[ym].purchase += count
        }

        kpis.revenue += value
      }
    }

    const trendSorted = Object.entries(trend)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([yearMonth, values]) => ({
        yearMonth,
        label: formatYearMonth(yearMonth),
        ...values
      }))

    // Process sources
    const sources = {}
    if (srcResponse[0].rows) {
      for (const row of srcResponse[0].rows) {
        const channel = row.dimensionValues[0].value
        const event = row.dimensionValues[1].value
        const count = parseInt(row.metricValues[0].value)
        const value = parseFloat(row.metricValues[1].value)

        if (!sources[channel]) {
          sources[channel] = { monthly: 0, annual: 0, purchases: 0, revenue: 0.0 }
        }

        if (event === 'Monthly subscription') {
          sources[channel].monthly += count
        } else if (event === 'Annual subscription') {
          sources[channel].annual += count
        } else if (event === 'Purchase' || event === 'purchase') {
          sources[channel].purchases += count
        }

        sources[channel].revenue += value
      }
    }

    const sourceList = Object.entries(sources)
      .map(([channel, data]) => ({
        channel,
        total: data.monthly + data.annual + data.purchases,
        ...data
      }))
      .sort((a, b) => b.total - a.total)

    // Process traffic
    const traffic = []
    if (trafResponse[0].rows) {
      for (const row of trafResponse[0].rows) {
        const ym = row.dimensionValues[0].value
        const sessions = parseInt(row.metricValues[0].value)
        traffic.push({
          yearMonth: ym,
          label: formatYearMonth(ym),
          sessions
        })
      }
    }

    // Process channels
    let totalSessions = 0
    if (chanResponse[0].rows) {
      totalSessions = chanResponse[0].rows.reduce((sum, row) => sum + parseInt(row.metricValues[0].value), 0)
    }

    const channels = []
    if (chanResponse[0].rows) {
      for (const row of chanResponse[0].rows) {
        const sessions = parseInt(row.metricValues[0].value)
        channels.push({
          channel: row.dimensionValues[0].value,
          sessions,
          users: parseInt(row.metricValues[1].value),
          newUsers: parseInt(row.metricValues[2].value),
          pct: totalSessions ? Math.round((sessions / totalSessions) * 1000) / 10 : 0
        })
      }
    }

    const result = {
      kpis,
      trend: trendSorted,
      sources: sourceList,
      traffic,
      channels,
      show_revenue: SHOW_REVENUE,
      date_range: { start: startDate, end: endDate }
    }

    // Cache result
    cacheSet(cacheKey, result)

    return Response.json(result)
  } catch (error) {
    console.error('Analytics error:', error)
    return Response.json({ error: error.message || 'Failed to fetch analytics data' }, { status: 500 })
  }
}
