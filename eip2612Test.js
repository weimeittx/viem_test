// const { ethers, Wallet, formatEther } = require('ethers')
import { ethers, Wallet, formatEther, Signature } from 'ethers'
import eip2612 from './abi/eip2612.js'
// const eip2612 = require('./abi/eip2612.json')

const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545')
;(async () => {
    //发送的钱包
    let wallet = new Wallet(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        // '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        provider
    )

    let spenderWallet = new Wallet(
        '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        provider
    )
    const token = new ethers.Contract(
        '0x809d550fca64d94Bd9F66E60752A544199cfAC3D',
        eip2612,
        spenderWallet
    )

    const balance = await token.balanceOf(spenderWallet.address)
    console.log(formatEther(balance))

    const domain = {
        name: await token.name(),
        version: '1',
        chainId: (await provider.getNetwork()).chainId,
        verifyingContract: '0x809d550fca64d94Bd9F66E60752A544199cfAC3D',
    }
    console.log('domain:', domain)

    const types = {
        Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
        ],
    }

    const owner = wallet.address
    const spender = spenderWallet.address // 接收者地址
    const value = ethers.parseEther('10') // 转账金额
    const nonce = await token.nonces(owner)
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60 // 1小时后过期

    const message = {
        owner,
        spender,
        value,
        nonce,
        deadline,
    }

    console.log('message:', message)
    // 签名
    const signature = await wallet.signTypedData(domain, types, message)
    const { v, r, s } = Signature.from(signature)

    const tx = await token.permitTransfer(owner, spender, value, deadline, v, r, s)

    await tx.wait()
    console.log('转账成功完成')
})()
