<template>
  <v-card outlined class="pa-4">
    <v-card-title>Input #{{ vidx }}</v-card-title>
    <v-text-field v-model="mnemonic" label="mnemonic" />
    <v-btn :loading="isConnecting" @click="connect()">Init Wallet</v-btn>
    Balance:
    <v-chip>{{ walletBalance }}</v-chip>
    <v-text-field v-model="pledgeAmount" label="Pledge Amount" />
    <v-btn :loading="isCreatingDenom" @click="createPledgeDenom()"
      >Create pledge denomination</v-btn
    >
    <v-textarea
      v-model="pledgeFromTransaction"
      label="pledge from transaction"
    />
    <v-text-field
      v-model="pledgeFromTransactionId"
      label="pledge from transaction id"
    />
  </v-card>
</template>

<script>
import Dash from 'dash'
import Dashcore from '@dashevo/dashcore-lib'

export default {
  props: {
    vidx: { type: Number, default: 0 },
    goalAmount: { type: Number, default: 3000000 },
    feeSatoshis: { type: Number, default: 1000 },
    toAddress: { type: String, default: '' },
    initmnemonic: { default: '', type: String },
  },
  data: () => {
    return {
      mnemonic: '',
      // 'neither neither apple collect warm trip luggage path tenant test liquid effort',
      // '',
      //  'catch fine embrace frequent prepare cruise relax faculty artwork yard sustain report'
      walletBalance: -1,
      isConnecting: false,
      isCreatingDenom: false,
      client: null,
      pledgeFromTransaction: '',
      pledgeFromTransactionId: '',
      pledgeFromAddress: '',
      pledgeAmount: 1500000,
    }
  },
  created() {
    this.mnemonic = this.initmnemonic
    this.connect()
    this.loopRefreshBalance()
  },
  methods: {
    async loopRefreshBalance() {
      if (this.client && this.client.account) {
        this.walletBalance = this.client.account.getTotalBalance()
      }
      await this.$sleep(1000)
      this.loopRefreshBalance()
    },
    async createPledgeDenom() {
      this.isCreatingDenom = true

      const specialFeatureKey = this.client.account.keyChain.HDPrivateKey.derive(
        `m/9'/1'/4'/1'/1` // TODO production LIVENET switch to 9/5
      )

      const privateKey = specialFeatureKey.privateKey.toString()

      this.pledgeFromAddress = specialFeatureKey.publicKey
        .toAddress()
        .toString()

      const transaction = this.client.account.createTransaction({
        recipients: [
          {
            recipient: this.pledgeFromAddress,
            satoshis: parseInt(this.pledgeAmount),
          },
        ],
      })

      this.pledgeFromTransaction = JSON.stringify(
        transaction.toJSON(),
        null,
        ' '
      )

      console.log('Broadcasting pledgeUtxo txs:')
      const transactionId = await this.client.account.broadcastTransaction(
        transaction
      )

      console.log('transactionId :>> ', transactionId)

      this.pledgeFromTransactionId = transactionId

      const pledgeUtxo = {
        txId: transactionId,
        outputIndex: 0,
        address: this.pledgeFromAddress,
        script: transaction.outputs[0]._script,
        satoshis: transaction.outputs[0]._satoshis,
      }

      console.log('pledgeUtxo :>> ', pledgeUtxo)

      console.log(
        'Pledge UTXO transaction successfully broadcast:',
        '\nWallet:',
        this.client.wallet.exportWallet(),
        '\ntxId:',
        transactionId,
        '\nfromAddress:',
        this.pledgeFromAddress
      )

      const tx = new Dashcore.Transaction()
        .from([pledgeUtxo])
        .to(this.toAddress, this.goalAmount - this.feeSatoshis)
        .sign([privateKey], 0x81) // 0x81 === SIGHASH_ALL|SIGHASH_ANYONECANPAY

      console.log('partially signed transaction :>> ', tx)

      this.$emit('setTx', tx)
      this.isCreatingDenom = false
    },
    async connect() {
      const { mnemonic } = this
      this.isConnecting = true

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

      if (this.client) this.client.disconnect()

      this.client = new Dash.Client(clientOpts)

      console.log('client.wallet :>> ', this.client.wallet)

      Object.entries(this.client.getApps().apps).forEach(([name, entry]) =>
        console.log(name, entry.contractId.toString())
      )

      this.client.account = await this.client.wallet.getAccount()

      console.log(
        'client connected, address',
        this.client.account.getUnusedAddress().address
      )

      console.log('init total Balance', this.client.account.getTotalBalance())
      this.walletBalance = this.client.account.getTotalBalance()
      this.isConnecting = false
    },
  },
}
</script>

<style></style>
