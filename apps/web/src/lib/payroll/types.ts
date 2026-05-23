export type Bracket = { min: number; max: number | null; rate: number }

export type Reliefs = {
  personal?: boolean
  marriage?: boolean
  dependantChildren?: number
  oldAge?: boolean
  agedDependant?: boolean
  disability?: boolean
}

export type ReliefRates = {
  personal: number
  marriage: number
  dependantPerChild: number
  oldAge: number
  agedDependant: number
  disabilityPct: number
}

export type RatePack = {
  paye: Bracket[]
  ssnitEmployee: number
  ssnitEmployer: number
  tier2: number
  reliefs: ReliefRates
}

export type PayslipComponent = {
  componentId: string
  code: string
  name: string
  type: "EARNING" | "DEDUCTION" | "STATUTORY" | "LOAN"
  taxable: boolean
  pensionable: boolean
  amount: number
}

export type PayslipInput = {
  basicSalary: number
  components: PayslipComponent[]
  daysWorked: number
  daysInMonth: number
  reliefs: Reliefs
  loans: { id: string; monthlyDeduction: number; balance: number }[]
  rates: RatePack
  ytd: { gross: number; paye: number; ssnit: number }
}

export type PayslipOutput = {
  basicSalary: number
  totalEarnings: number
  totalDeductions: number
  gross: number
  paye: number
  ssnitEmployee: number
  ssnitEmployer: number
  tier2: number
  loanDeductions: number
  otherDeductions: number
  netPay: number
  loanApplied: { loanId: string; amount: number }[]
  ytdGross: number
  ytdPaye: number
  ytdSsnit: number
  snapshot: {
    rates: RatePack
    components: PayslipComponent[]
    reliefs: Reliefs
    daysWorked: number
    daysInMonth: number
  }
}
