import Dash from 'dash'
import Vue from 'vue'
// import localforage from 'localforage'

const Dashcore = require('@dashevo/dashcore-lib')
const Unit = Dashcore.Unit

const timeFunction = async (promiseToTime) => {
  const timingStart = Date.now()

  const promiseResult = await promiseToTime

  const timing = (Date.now() - timingStart) / 1000

  console.log(promiseResult, ` finished in ${timing}:>> `)

  return promiseResult
}

console.log('process.env:>> ', process.env)

let client, clientInitFinished

const getInitState = () => {
  return {
    snackbar: { show: false, color: 'red', text: '', timestamp: 0, link: null },
    dppCache: {},
    identityId: null,
    walletBalance: -1,
  }
}
export const state = () => getInitState()

export const getters = {
  getIdentityId(state) {
    return state.identityId
  },
  getSumPledges: (state) => (campaignId) => {
    console.log(campaignId)
    console.log('state.dppCache[campaignId] :>> ', state.dppCache[campaignId])
    const dppCache = Object.entries(state.dppCache)

    let sum = 0

    for (let idx = 0; idx < dppCache.length; idx++) {
      const element = dppCache[idx][1]
      // console.log('element', element)

      if (element.$type === 'pledge' && element.campaignId === campaignId)
        sum += JSON.parse(Buffer.from(element.utxo, 'base64').toString()).output
          .satoshis
    }

    return sum
  },
  getDocumentById: (state) => (docId) => {
    if (!docId)
      // TODO replace check with regexp
      throw new Error(
        `getDocumentById: Cannot get a document with docId: ${docId}`
      )
    return state.dppCache[docId]
  },
  getCampaignPledges: (state) => (campaignId) => {
    const dppCache = Object.entries(state.dppCache)

    const pledges = []

    for (let idx = 0; idx < dppCache.length; idx++) {
      const pledge = { ...dppCache[idx][1] }

      if (pledge.$type === 'pledge' && pledge.campaignId === campaignId) {
        pledge.utxo = JSON.parse(Buffer.from(pledge.utxo, 'base64').toString())

        pledges.push(pledge)
      }
    }
    console.log('pledges :>> ', pledges)
    return pledges
  },
}

export const mutations = {
  setWalletBalance(state, balance) {
    state.walletBalance = balance
  },
  setIdentityId(state, identityId) {
    state.identityId = identityId
  },
  setSnackBar(state, { text, color = 'red', link = null }) {
    state.snackbar.text = text
    state.snackbar.color = color
    state.snackbar.link = link
    state.snackbar.show = true
    state.snackbar.timestamp = Date.now()
  },
  setDppCache(state, { typeLocator, documents }) {
    // const [app, docType] = typeLocator.split('.')

    console.log('setting cache documents :>> ', documents)

    for (let i = 0; i < documents.length; i++) {
      const document = documents[i]

      console.log('document :>> ', document)

      Vue.set(state.dppCache, `${document.$id}`, document)
    }
  },
}

export const actions = {
  refreshBalance({ commit, state }) {
    const balance =
      client && client.account
        ? Unit.fromSatoshis(client.account.getTotalBalance()).toBTC()
        : -1

    if (balance !== state.walletBalance) commit('setWalletBalance', balance)
  },
  showSnackbar({ commit }, snackbar) {
    commit('setSnackBar', snackbar)
  },
  async isClientReady() {
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!clientInitFinished) {
      console.log('client not ready')
      await this.$sleep(250)
    }
    return true
  },
  async isAccountReady() {
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!clientInitFinished) {
      console.log('client not ready')
      await this.$sleep(250)
    }

    while (!client.wallet) {
      console.log('client init without mnemonic, please log in')
      await this.$sleep(250)
    }

    client.account = await client.wallet.getAccount({ index: 0 })
  },
  async initWallet({ state, commit }, { mnemonic }) {
    clientInitFinished = false

    commit('setIdentityId', null)

    console.log('Initializing Dash.Client with mnemonic: ', mnemonic)

    let clientOpts = {
      passFakeAssetLockProofForTests: process.env.LOCALNODE,
      dapiAddresses: process.env.DAPIADDRESSES,
      wallet: typeof mnemonic !== 'undefined' ? { mnemonic } : undefined,
    }

    // Remove undefined keys
    clientOpts = JSON.parse(JSON.stringify(clientOpts))

    // if (clientOpts.wallet) clientOpts.wallet.adapter = localforage

    console.dir({ clientOpts }, { depth: 100 })

    if (client) timeFunction(client.disconnect())

    client = new Dash.Client(clientOpts)

    console.log('client.wallet :>> ', client.wallet)

    Object.entries(client.getApps().apps).forEach(([name, entry]) =>
      console.log(name, entry.contractId.toString())
    )

    if (client.wallet) {
      client.account = await timeFunction(client.wallet.getAccount())

      console.log(
        'init Funding address',
        client.account.getUnusedAddress().address
      )
      console.log('init total Balance', client.account.getTotalBalance())

      // An account without identity can't submit documents, so let's create one
      if (!client.account.getIdentityIds().length) {
        const start = Date.now()
        const identity = await client.platform.identities.register()
        const timing = Math.floor(start - Date.now() / 1000)
        console.log(`identity registered in ${timing}:>> `, identity)
      }

      commit('setIdentityId', client.account.getIdentityIds()[0].toString())
    } else {
      console.log(
        'Initialized client without a wallet, you can fetch documents but not create documents, identities or names !!'
      )
    }
    clientInitFinished = true
  },
  async submitDocument({ dispatch, commit }, { typeLocator, doc }) {
    console.log(`submitDocument to ${typeLocator}`, doc)

    await dispatch('isAccountReady')

    const { platform } = client

    try {
      const identityId = client.account.getIdentityIds()[0]

      const getStart = Date.now()

      const identity = await platform.identities.get(identityId)

      console.log(
        'Get identity finished in: ',
        (Date.now() - getStart) / 1000,
        identity
      )

      // Create the document
      const document = await platform.documents.create(
        typeLocator,
        identity,
        doc
      )

      console.log('created document :>> ', document)

      const documentBatch = {
        create: [document],
        replace: [],
        delete: [],
      }

      const result = await platform.documents.broadcast(documentBatch, identity)

      console.log(`submitDocument result: ${typeLocator} :>> `, result)

      commit('setDppCache', { typeLocator, documents: result.transitions })

      return result
    } catch (e) {
      dispatch('showSnackbar', { text: e.message })
      console.error('Something went wrong:', e)
    }
  },
  async fetchDocumentById({ dispatch, commit }, { typeLocator, docId }) {
    const queryOpts = {
      limit: 1,
      startAt: 1,
      where: [['$id', '==', docId]],
    }

    console.log(
      `fetchDocumentById ${typeLocator}`,
      client.getApps().get(typeLocator.split('.')[0]).contractId.toString(),
      queryOpts
    )

    await dispatch('isClientReady')

    try {
      const [result] = await client.platform.documents.get(
        `${typeLocator}`,
        queryOpts
      )

      const document = result.toJSON()

      console.log(
        `fetched DocumentById ${typeLocator}`,
        { queryOpts },
        document
      )
      commit('setDppCache', { typeLocator, documents: [document] })
      return document
    } catch (e) {
      console.error(
        'Something went wrong:',
        'fetchDocuments()',
        {
          typeLocator,
          queryOpts,
        },
        e
      )
      dispatch('showSnackbar', { text: e, color: 'red' })
    }
  },
  async fetchDocuments(
    { dispatch, commit },
    {
      typeLocator,
      queryOpts = {
        limit: 1,
        startAt: 1,
      },
    }
  ) {
    console.log(
      `fetchDocuments ${typeLocator}`,
      client.getApps().get(typeLocator.split('.')[0]).contractId.toString(),
      queryOpts
    )

    await dispatch('isClientReady')

    try {
      const result = await client.platform.documents.get(
        `${typeLocator}`,
        queryOpts
      )

      const documents = result.map((el) => el.toJSON())

      console.log(`fetched Documents ${typeLocator}`, { queryOpts }, documents)
      commit('setDppCache', { typeLocator, documents })
      return documents
    } catch (e) {
      console.error(
        'Something went wrong:',
        'fetchDocuments()',
        {
          typeLocator,
          queryOpts,
        },
        e
      )
      dispatch('showSnackbar', { text: e, color: 'red' })
    }
  },
}
