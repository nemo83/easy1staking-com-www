export const EASY1STAKING_API = process.env.NEXT_PUBLIC_EASY1STAKING_API
export const SCOOPER_API = process.env.NEXT_PUBLIC_SCOOPER_API

export const EASY1_STAKE_POOL_HASH = "20df8645abddf09403ba2656cda7da2cd163973a5e439c6e43dcbea9"
export const EASY1_STAKE_POOL_ID = "pool1yr0cv3dtmhcfgqa6yetvmf769ngk89e6tepecmjrmjl2jzcw2lm"

// Scooper public key hash mappings
export const EASY1_SCOOPER_HASH = "37eb116b3ff8a70e4be778b5e8d30d3b40421ffe6622f6a983f67f3f"

export const SCOOPER_NAMES: Record<string, string> = {
  [EASY1_SCOOPER_HASH]: "EASY1",
  "f90599106a15fca2bf2829124ddcb11a4dcd53916f46f209d16f1fbb": "TITAN",
  "c0f984cacef4eb54112e3fbcea7a8f5c20c10151f982409968525933": "AHL",
  "8a0fdfd566a537017bce807cbc223eb1b00e969bae146457e11c4de8": "BCSH",
  "8b3682172c0ddd36ea2db1fedd8ebaad3fae44599b08895d13a65ada": "AZUR"
  // Add more known scoopers here as they're identified
}

export const getScooperName = (hash: string): string => {
  return SCOOPER_NAMES[hash] || `${hash.substring(0, 8)}...`
}
