import { prisma } from "@/lib/db"
import { TaxRateType } from "@prisma/client"
import type { RatePack, Bracket } from "./types"

export async function loadRatePack(workspaceId: string, year: number): Promise<RatePack> {
  const rows = await prisma.taxRateTable.findMany({
    where: { workspaceId, taxYear: year },
    orderBy: [{ type: "asc" }, { sequence: "asc" }],
  })

  const get = (type: TaxRateType) => Number(rows.find(r => r.type === type)?.value ?? 0)

  const paye: Bracket[] = rows
    .filter(r => r.type === TaxRateType.PAYE_BRACKET)
    .sort((a, b) => a.sequence - b.sequence)
    .map(r => ({
      min: Number(r.bracketMin ?? 0),
      max: r.bracketMax != null ? Number(r.bracketMax) : null,
      rate: Number(r.value),
    }))

  if (paye.length === 0) {
    throw new Error(`No PAYE brackets configured for workspace ${workspaceId} year ${year}`)
  }

  return {
    paye,
    ssnitEmployee: get(TaxRateType.SSNIT_EMPLOYEE),
    ssnitEmployer: get(TaxRateType.SSNIT_EMPLOYER),
    tier2:         get(TaxRateType.TIER2),
    reliefs: {
      personal:          get(TaxRateType.RELIEF_PERSONAL),
      marriage:          get(TaxRateType.RELIEF_MARRIAGE),
      dependantPerChild: get(TaxRateType.RELIEF_DEPENDANT_PER_CHILD),
      oldAge:            get(TaxRateType.RELIEF_OLD_AGE),
      agedDependant:     get(TaxRateType.RELIEF_AGED_DEPENDANT),
      disabilityPct:     get(TaxRateType.RELIEF_DISABILITY_PCT),
    },
  }
}
