import React, { useEffect, useState } from 'react'
import Cookies from 'js-cookie'
import * as Fathom from 'fathom-client'
import * as Sentry from '@sentry/react'
import { Integrations } from '@sentry/tracing'
import { HotKeys } from 'react-hotkeys'
import { ethers } from 'ethers'
import { ReactQueryDevtools } from 'react-query/devtools'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Provider as JotaiProvider } from 'jotai'
import {
  initProviderApiKeys,
  useInitCookieOptions,
  useInitReducedMotion,
  useInitTheGraphApiKey
} from '@pooltogether/hooks'
import { useOnboard, useInitializeOnboard } from '@pooltogether/bnc-onboard-hooks'
import {
  ToastContainer,
  LoadingScreen,
  TransactionStatusChecker,
  TxRefetchListener
} from '@pooltogether/react-components'

import {
  HOTKEYS_KEY_MAP,
  COOKIE_OPTIONS,
  REFERRER_ADDRESS_KEY,
  DEFAULT_QUERY_OPTIONS,
  CUSTOM_WALLET_CONFIG
} from 'lib/constants'
import { AllContextProviders } from 'lib/components/contextProviders/AllContextProviders'
import { BodyClasses } from 'lib/components/BodyClasses'
import { CustomErrorBoundary } from 'lib/components/CustomErrorBoundary'
import { ManualWarningMessage } from 'lib/components/ManualWarningMessage'

import '@reach/dialog/styles.css'
import '@reach/menu-button/styles.css'
import '@reach/tooltip/styles.css'

import 'assets/styles/index.css'
import 'assets/styles/flagship.css'

// Imoport i18n config
import '../i18n'
import { useTranslation } from 'react-i18next'
import { AnimatePresence } from 'framer-motion'
import { ManageTicketsWizardContainer } from 'lib/components/ManageTicketsWizardContainer'
import { ClaimRetroactivePoolWizardContainer } from 'lib/components/ClaimRetroactivePoolWizard'
import { WrongNetworkModal } from 'lib/components/WrongNetworkModal'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...DEFAULT_QUERY_OPTIONS
    }
  }
})

// Initialize read provider API keys
initProviderApiKeys({
  alchemy: process.env.NEXT_JS_ALCHEMY_API_KEY,
  etherscan: process.env.NEXT_JS_ETHERSCAN_API_KEY,
  infura: process.env.NEXT_JS_INFURA_ID
})

if (typeof window !== 'undefined') {
  window.ethers = ethers
}

if (process.env.NEXT_JS_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_JS_SENTRY_DSN,
    release: process.env.NEXT_JS_RELEASE_VERSION,
    integrations: [new Integrations.BrowserTracing()]
  })
}

let checkForElementIntervalId

function MyApp({ Component, pageProps, router }) {
  const { i18n } = useTranslation()

  const deposit = /deposit/.test(router.asPath)
  const manage = /\/manage-tickets/.test(router.asPath)

  useEffect(() => {
    if (router?.query?.referrer) {
      const referrerAddress = router.query.referrer

      try {
        ethers.utils.getAddress(referrerAddress)

        Cookies.set(REFERRER_ADDRESS_KEY, referrerAddress.toLowerCase(), COOKIE_OPTIONS)
      } catch (e) {
        console.error(`referrer address was an invalid Ethereum address:`, e.message)
      }
    }
  }, [])

  useEffect(() => {
    const fathomSiteId = process.env.NEXT_JS_FATHOM_SITE_ID

    if (fathomSiteId) {
      Fathom.load(process.env.NEXT_JS_FATHOM_SITE_ID, {
        url: 'https://goose.pooltogether.com/script.js',
        includedDomains: ['v3.pooltogether.com', 'app-v3.pooltogether.com']
      })

      function onRouteChangeComplete(url) {
        if (window['fathom']) {
          window['fathom'].trackPageview()
        }
      }

      router.events.on('routeChangeComplete', onRouteChangeComplete)

      return () => {
        router.events.off('routeChangeComplete', onRouteChangeComplete)
      }
    }
  }, [])

  // scroll to any hash # links (ie. '/rewards#sponsorship)
  const scrollToHashElement = () => {
    const checkForElement = () => {
      const hashId = window.location.hash

      if (hashId) {
        // Use the hash to find the first element with that id
        const element = document.querySelector(hashId)

        if (element) {
          // Smooth scroll to that elment
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
          })

          clearInterval(checkForElementIntervalId)
        }
      }
    }

    checkForElementIntervalId = setInterval(checkForElement, 600)
  }

  useEffect(() => {
    scrollToHashElement()

    const handleExitComplete = () => {
      if (typeof window !== 'undefined') {
        // window.scrollTo({ top: 0 })

        // make sure opacity gets set back to 1 after page transitions!
        setTimeout(() => {
          const elem = document.getElementById('content-animation-wrapper')

          // in case the animation failed
          if (elem) {
            elem.style.opacity = '1'
          }
        }, 1000)

        scrollToHashElement()
      }
    }

    router.events.on('routeChangeComplete', handleExitComplete)
    return () => {
      router.events.off('routeChangeComplete', handleExitComplete)
    }
  }, [])

  const { network, address, provider } = useOnboard()

  return (
    <HotKeys
      keyMap={HOTKEYS_KEY_MAP}
      className='outline-none focus:outline-none active:outline-none'
    >
      <JotaiProvider>
        <QueryClientProvider client={queryClient}>
          <InitPoolTogetherHooks>
            <BodyClasses />

            <ToastContainer className='pool-toast' position='top-center' autoClose={7000} />

            <AllContextProviders>
              <CustomErrorBoundary>
                <TransactionStatusChecker network={network} address={address} provider={provider} />

                <TxRefetchListener />

                <ManualWarningMessage />

                <AnimatePresence>{manage && <ManageTicketsWizardContainer />}</AnimatePresence>

                <ClaimRetroactivePoolWizardContainer />

                <WrongNetworkModal />

                <LoadingScreen isInitialized={i18n.isInitialized}>
                  <Component {...pageProps} />
                </LoadingScreen>

                <ReactQueryDevtools />
              </CustomErrorBoundary>
            </AllContextProviders>
          </InitPoolTogetherHooks>
        </QueryClientProvider>
      </JotaiProvider>
    </HotKeys>
  )
}

const InitPoolTogetherHooks = ({ children }) => {
  useInitTheGraphApiKey(process.env.NEXT_JS_THE_GRAPH_API_KEY)
  useInitReducedMotion(Boolean(process.env.NEXT_JS_REDUCE_MOTION))
  useInitCookieOptions(process.env.NEXT_JS_DOMAIN_NAME)
  useInitializeOnboard({
    infuraId: process.env.NEXT_JS_INFURA_ID,
    fortmaticKey: process.env.NEXT_JS_FORTMATIC_API_KEY,
    portisKey: process.env.NEXT_JS_PORTIS_API_KEY,
    defaultNetworkName: 'homestead',
    customWalletsConfig: CUSTOM_WALLET_CONFIG
  })

  return children
}

export default MyApp
