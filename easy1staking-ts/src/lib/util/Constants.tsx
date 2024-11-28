import { applyCborEncoding, PlutusScript } from "@meshsdk/core"

export const BLOCKFROST_API_KEY = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY

export const WMT_CONVERSION_SCRIPT: PlutusScript = {
    code: applyCborEncoding('59039f0100003323232323232322232322533300632323253330093006300a3754002264646464646464a666026602c00426464a66602466602466e3cdd718098019bae300130143754022941288b0a999809180798099baa01013233001001375860306032603260326032602a6ea8048894ccc05c004528899299980a99191980080080591299980d8008a5013253330193371e6eb8c078008010528899801801800980f0009bae301a00213300300300114a060340022a666024601e60266ea8c8cc004004024894ccc05c004530103d87a80001323253330163232533301b00114a02a666036603c00226464a66603466e3cdd7180d8011bae3004301c37540322a66603466e1c0280044cdd79804980e1baa006301f302030203020301c375403229405281bad301b001301d00114a0660146eacc004c064dd50019bae301c301d301d3019375402c46038603a002266e9520003301a0024bd70099802002000980d801180c8008a511623017001375a60240022c60280026600264660020026eacc050010894ccc04c00452f5bded8c0264646464a66602866e3d221000021003133018337606ea4008dd3000998030030019bab3015003375c6026004602e004602a0026eb8c04cc040dd50031119299980819b8748008c044dd50008a5eb7bdb1804dd5980a98091baa001323300100100322533301400114c0103d87a8000132323253330143371e00c6eb8c05400c4cdd2a4000660306e980052f5c026600a00a0046eacc054008c060008c058004dd618089809180918091809000980898088011bac300f001300f300f300b37540042c601a601c004601800260106ea800452613656325333005300200115333008300737540062930b0a99980299b874800800454ccc020c01cdd50018a4c2c2c600a6ea8008dc3a4000ae6955ceaab9e5573eae815d0aba24c01f1d8799f51576f726c644d6f62696c65546f6b656e5850776f726c646d6f62696c65746f6b656e581c1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1ed8799fd87a9f581c7815664ddcf92f023c9f6e7e0792d6b2f733282486993613e549d8b6ffd8799fd8799fd87a9f581ce2667f1aba5f840845f1dfb453764a774c2b67dd7c0d968c5c172480ffffffff9f581c4c0b87c21190ad6f6144d0609761a8af515efd3fabcc8d929d63e9e3581c1423d22ea96d09b88162b1b7a9a88df1bfc2aec37cd805428d6a0d33581cfd82c56701320be6acb42f8ba7590a5e207325adc3ed61112901463fffff0001'),
    version: 'V2'
}

export const EASY1STAKING_API = process.env.NEXT_PUBLIC_EASY1STAKING_API

export const EASY1_STAKE_POOL_HASH = "20df8645abddf09403ba2656cda7da2cd163973a5e439c6e43dcbea9"
export const EASY1_STAKE_POOL_ID = "pool1yr0cv3dtmhcfgqa6yetvmf769ngk89e6tepecmjrmjl2jzcw2lm"
