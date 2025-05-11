// index.js
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

// 创建客户端
const client = createPublicClient({
    chain: mainnet,
    transport: http('http://127.0.0.1:8545'),
})

// 合约地址和ABI
const contractAddress = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9'
const abi = parseAbi([
    'event NFTPurchased(address indexed buyer, address indexed seller, address indexed nftContract, uint256 tokenId, address paymentToken, uint256 price)',
    'event NFTListed(address indexed seller, address indexed nftContract, uint256 tokenId, address paymentToken, uint256 price)'
])

async function watchNFTListedEvents() {
    const unwatch = client.watchContractEvent({
        address: contractAddress,
        abi,
        eventName: 'NFTListed',
        onLogs: (logs) => {
            console.log('新的NFTListed事件:', logs)
        },
        onError: (error) => {
            console.error('监听事件时出错:', error)
        },
    })
}

// 监听买入事件
async function watchNFTPurchasedEvents() {
    const unwatch = client.watchContractEvent({
        address: contractAddress,
        abi,
        eventName: 'NFTPurchased',
        onLogs: (logs) => {
            console.log('新的NFTPurchased事件:', logs)
        },
        onError: (error) => {
            console.error('监听事件时出错:', error)
        },
    })

    // 当你需要停止监听时，调用unwatch函数
    // unwatch()
}

// 开始监听
Promise.all([
    watchNFTListedEvents(),
    watchNFTPurchasedEvents()
]);
