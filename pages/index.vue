<template>
  <div>
    <v-row>
      <v-col cols="10" class="mx-auto" border="primary">
        <v-alert class="mx-auto">
          <a
            href="https://github.com/dashameter/sighash_anyonecanpay"
            target="_blank"
            >Read the docs</a
          ><br />
          Watch the debug console for thrown errors.
        </v-alert>
        <v-card outlined max-width="500px" class="mx-auto">
          <v-text-field
            v-model="inputCount"
            label="Number of inputs"
            :rules="[(value) => value > 0 || 'At least 1']"
          />
          <v-text-field v-model="goalAmount" label="Funding goal in duffs" />
          <v-text-field v-model="feeSatoshis" label="Transaction fee" />
          <v-text-field v-model="toAddress" label="Payout Address" />
        </v-card>
        <v-divider />
      </v-col>
    </v-row>
    <v-row>
      <v-sheet class="mx-auto pa-4">
        <v-row>
          <v-col v-for="(n, vidx) in parseInt(inputCount || 1)" :key="vidx">
            {{ vidx }}
            <VInput
              :key="vidx"
              :vidx="n"
              :initmnemonic="initmnemonics[vidx]"
              :goal-amount="parseInt(goalAmount)"
              :to-address="toAddress"
              :fee-satoshis="parseInt(feeSatoshis)"
              @setTx="setTxx(vidx, $event)"
            />
            <v-textarea v-model="inputs[vidx]" label="0x81 transaction" />
            <v-btn label="add input1" @click="useTx(vidx)">
              Use this transaction
            </v-btn>
            <v-textarea v-model="inputsJson[vidx]" label="0x81 input" />
            <v-btn label="add input1" @click="addInputDirect(vidx)">
              Add Input from memory (works)
            </v-btn>
            <v-textarea v-model="inputsHex[vidx]" label="0x81 input hex" />
            Dashcore.Script.Interpreter().verify(): <br />
            <strong> {{ verifyInput(vidx) }}</strong
            ><br />
            <v-btn label="add input1" @click="addInputHex(vidx)">
              Add Input from Hex (throws error)
            </v-btn>
          </v-col>
        </v-row>
        <v-divider />
        Output:
        <v-divider />
        Dashcore.Script.Interpreter().verify(): <br />
        <strong> {{ verifyRedeemTxOutput() }}</strong
        ><br />
        transaction.isFullySigned(): <br />
        <strong> {{ isRedeemTxFullySigned() }}</strong
        ><br />
        Redeem Tx with combined Inputs:
        <v-textarea :value="redeemTx" label="Redeem Tx" />
        <v-btn @click="broadcastRedeemTx()"> broadcast Redeem Tx </v-btn>
        <v-alert>
          Redeem Result:<br />
          {{ redeemResult }}
        </v-alert>
      </v-sheet>
    </v-row>
  </div>
</template>

<script>
import Vue from 'vue'
import Dash from 'dash'
import Dashcore from '@dashevo/dashcore-lib'
import VInput from '~/components/Input'

export default {
  components: { VInput },
  data: () => {
    return {
      inputCount: 2,
      inputs: {},
      inputsJson: {},
      inputsHex: {},
      initmnemonics: [],
      client: null,
      goalAmount: 3000000,
      feeSatoshis: 1000,
      toAddress: 'yPeRRTJg44yBdDmhvLSVvdUyc3DyA1Expw',
      redeemTxRaw: null,
      input1: '',
      input2: '',
      mnemonic:
        'shock immense hand zoo mean seat vehicle artwork element month story water',
      redeemResult: '',
    }
  },
  computed: {
    redeemTx() {
      return this.redeemTxRaw
    },
  },
  created() {
    console.log('this.$route :>> ', this.$route)
    const initm1 =
      // 'pride dolphin pluck orphan crunch erode soft damage metal corn risk slot',
      // 'shock immense hand zoo mean seat vehicle artwork element month story water',
      // 'catch fine embrace frequent prepare cruise relax faculty artwork yard sustain report',
      'luggage vacuum solution element rigid have provide enough defense champion frog camera'
    this.initmnemonics.push(initm1)

    const initm2 =
      // 'injury slender heart powder shove canal crash exile nest cement impact chair',
      // 'economy annual cool rally minute toast gas oyster august lamp sail isolate',
      //   'neck neither tired bargain pizza quantum anxiety wait hire network nasty joke'
      'essay love suffer inquiry buffalo advance glue boil arrive glove clutch oyster'
    this.initmnemonics.push(initm2)

    this.redeemTxRaw = new Dashcore.Transaction()
  },
  methods: {
    isRedeemTxFullySigned() {
      let res
      try {
        res = this.redeemTxRaw.isFullySigned()
      } catch (e) {
        res = e.message
      }
      return res
    },
    verifyRedeemTxOutput() {
      let res
      try {
        res = Dashcore.Script.Interpreter().verify(
          this.redeemTxRaw.outputs[0].script
        )
      } catch (e) {
        res = e.message
      }
      return res
    },
    verifyInput(vidx) {
      let res
      try {
        const json = JSON.parse(
          Buffer.from(this.inputsHex[vidx], 'hex').toString()
        )

        const input = Dashcore.Transaction.Input(json)

        res = Dashcore.Script.Interpreter().verify(input.script)
      } catch (e) {
        res = e.message
      }
      return res
    },
    reload() {
      this.$router.push('/0x81/?inputCount=' + this.inputCount)
    },
    setTxx(vidx, tx) {
      console.log('setinput, vidx,tx :>> ', vidx, tx)

      Vue.set(this.inputs, vidx, tx)

      Vue.set(this.inputsJson, vidx, JSON.stringify(tx.toJSON()))

      Vue.set(
        this.inputsHex,
        vidx,
        Buffer.from(JSON.stringify(tx.inputs[0].toJSON())).toString('hex')
      )
    },
    useTx(vidx) {
      this.redeemTxRaw = this.inputs[vidx]
      let verification
      verification = Dashcore.Script.Interpreter().verify(
        this.redeemTxRaw.inputs[0].script
      )
      console.log('verification :>> ', verification)

      verification = Dashcore.Script.Interpreter().verify(
        this.redeemTxRaw.outputs[0].script
      )
      console.log('verification :>> ', verification)
    },
    addInputDirect(vidx) {
      this.redeemTxRaw.addInput(this.inputs[vidx].inputs[0])
    },
    addInputHex(vidx) {
      //   this.redeemTxRaw.addInput(this.input2.inputs[0])

      // const tx2hex = Buffer.from(
      //   JSON.stringify(this.inputs[vidx].toJSON())
      // ).toString('hex')

      // const tx2 = new Dashcore.Transaction(
      //   JSON.parse(Buffer.from(tx2hex, 'hex'))
      // )
      // this.redeemTxRaw.addInput(tx2.inputs[0])

      console.log(
        '      const in2 = Dashcore.Transaction.Input( :>> ',
        JSON.parse(Buffer.from(this.inputsHex[vidx], 'hex').toString())
      )
      let verification
      const in2 = Dashcore.Transaction.Input(
        JSON.parse(Buffer.from(this.inputsHex[vidx], 'hex').toString())
      )
      verification = Dashcore.Script.Interpreter().verify(in2.script)
      console.log('in2 verification :>> ', verification)

      this.redeemTxRaw.addInput(in2)
      verification = Dashcore.Script.Interpreter().verify(
        this.redeemTxRaw.inputs[0].script
      )
      console.log('verification :>> ', verification)
      verification = Dashcore.Script.Interpreter().verify(
        this.redeemTxRaw.inputs[1].script
      )
      console.log('verification :>> ', verification)
      verification = Dashcore.Script.Interpreter().verify(
        this.redeemTxRaw.outputs[0].script
      )
      console.log('verification :>> ', verification)
      // debugger
    },
    async broadcastRedeemTx() {
      await this.connect()
      let res
      try {
        const redeemTxId = await this.client.account.broadcastTransaction(
          this.redeemTxRaw
        )
        console.log('redeemTxId :>> ', redeemTxId)
        res = redeemTxId
      } catch (e) {
        res = e.message
      }
      this.redeemResult = res
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
