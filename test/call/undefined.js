const Web3 = require('web3');
const assert = require('assert');
const Ganache = require("../../index.js");
const path = require("path");
const to = require("../../lib/utils/to");

const {compileAndDeploy} = require ('../helpers/contracts');

const mnemonic = 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat';

function setUp(options = {mnemonic}, contractName = 'Example') {
  const context = {
    options: options,
    provider: null,
    web3: null,
    accounts: [],
    contractArtifact: {},
    instance: null
  };

  before ('setup web3', async function() {
    context.options.vmErrorsOnRPCResponse = false;
    
    context.provider = new Ganache.provider(context.options);
    context.web3 = new Web3(context.provider);
  })

  before('get accounts', async function() {
    context.accounts = await context.web3.eth.getAccounts();
  })

  before("compile source", async function() {
    this.timeout(10000);
    context.contractArtifact = await compileAndDeploy(path.join(__dirname, '.', `${contractName}.sol`), contractName, context.web3);
    context.instance = context.contractArtifact.instance;
  });

  return context;
}

describe('call:undefined', function() {
  let context = setUp({mnemonic}, "Call");

  // TODO: this one should error with something like `Error: Couldn't decode bool from ABI: 0x` instead of `RuntimeError: VM Exception while processing transaction: revert`
  it("should return `0x` when eth_call fails (web3.eth call)", async function() {
    let {instance, web3} = context;

    const signature = instance.methods.causeReturnValueOfUndefined()._method.signature;
    // test raw JSON RPC value:
    const result = await web3.eth.call({
      to: instance._address,
      data: signature
    });
    assert.strictEqual(result, "0x");
  });

  it("should throw due to returned value of `0x` when eth_call fails (compiled contract call)", function(done) {
    let {instance} = context;
    // running this test with callback style because I couldn't get `assert.throws` 
    // to work with async/await (in node 10.0.0 this is handled by `assert.rejects`)
    instance.methods.causeReturnValueOfUndefined().call((err) => {
      // web3 will try to parse this return value of `0x` to something, but there is no
      // way to properly represent the DATA type `0x` in JS.
      assert.strictEqual(err.message, "Couldn't decode bool from ABI: 0x");
      done();
    });
  });

  it("should return a value when contract and method exists at block (web3.eth.call)", async function() {
    const {instance, web3} = context;

    const signature = instance.methods.theAnswerToLifeTheUniverseAndEverything()._method.signature;
    // test raw JSON RPC value:
    const result = await web3.eth.call({
      to: instance._address,
      data: signature
    }, "latest");
    assert.strictEqual(to.number(result), 42);
  });

  it("should return a value when contract and method exists at block (compiled contract call)", async function() {
    const {instance} = context;
    const result = await instance.methods.theAnswerToLifeTheUniverseAndEverything().call();
    assert.strictEqual(result, "42");
  });

  it("should return 0x when contract doesn't exist at block", async function() {
    const {instance, web3} = context;

    const signature = instance.methods.theAnswerToLifeTheUniverseAndEverything()._method.signature;
    const result = await web3.eth.call({
      to: instance._address,
      data: signature
    }, "earliest");

    assert.equal(result, "0x");
  });

  it("should return 0x when method doesn't exist at block", async function() {
    const {instance, web3} = context;

    const result = await web3.eth.call({
      to: instance._address,
      data: "0x01234567"
    }, "latest");

    assert.equal(result, "0x");
  });
});
