#!/usr/bin/env node


import { createWalletClient, createPublicClient, http, parseEther, formatEther, parseAbi, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as readline from 'readline';
import { randomBytes } from 'crypto';
import * as fs from 'fs';

// ERC20代币合约ABI
const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
]);

// 初始化客户端
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://1rpc.io/sepolia') // 使用公共RPC节点
});

// 创建钱包文件路径
const WALLET_FILE = './wallet.json';

// 创建readline接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 询问函数
function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

// 主菜单
async function showMenu() {
  console.log('\n=== 命令行钱包 ===');
  console.log('1. 生成新钱包');
  console.log('2. 查询ETH余额');
  console.log('3. 查询ERC20代币余额');
  console.log('4. 发送ERC20代币转账');
  console.log('5. 退出');

  const choice = await question('请选择操作(1-5): ');
  
  switch(choice) {
    case '1': 
      await generateWallet();
      break;
    case '2': 
      await checkETHBalance();
      break;
    case '3': 
      await checkERC20Balance();
      break;
    case '4': 
      await sendERC20Transfer();
      break;
    case '5': 
      console.log('退出程序');
      rl.close();
      return;
    default:
      console.log('无效的选择，请重试');
  }
  
  showMenu();
}

// 生成新钱包
async function generateWallet() {
  // 生成随机私钥
  const privateKey = `0x${randomBytes(32).toString('hex')}`;
  const account = privateKeyToAccount(privateKey);
  
  const walletData = {
    address: account.address,
    privateKey: privateKey
  };
  
  // 保存到文件
  fs.writeFileSync(WALLET_FILE, JSON.stringify(walletData, null, 2));
  
  console.log('新钱包已生成并保存到wallet.json');
  console.log(`地址: ${account.address}`);
  console.log(`私钥: ${privateKey}`);
}

// 加载钱包
function loadWallet() {
  try {
    if (fs.existsSync(WALLET_FILE)) {
      const data = fs.readFileSync(WALLET_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('加载钱包失败:', error.message);
  }
  return null;
}

// 查询ETH余额
async function checkETHBalance() {
  const wallet = loadWallet();
  if (!wallet) {
    console.log('未找到钱包，请先生成钱包');
    return;
  }
  
  try {
    const balance = await publicClient.getBalance({
      address: wallet.address,
    });
    
    console.log(`钱包地址: ${wallet.address}`);
    console.log(`ETH余额: ${formatEther(balance)} ETH`);
  } catch (error) {
    console.error('查询余额失败:', error.message);
  }
}

// 查询ERC20代币余额
async function checkERC20Balance() {
  const wallet = loadWallet();
  if (!wallet) {
    console.log('未找到钱包，请先生成钱包');
    return;
  }
  
  const tokenAddress = await question('请输入ERC20代币合约地址: ');
  
  try {
    // 获取代币信息
    const symbol = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'symbol',
    });
    
    const decimals = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'decimals',
    });
    
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [wallet.address],
    });
    
    const formattedBalance = Number(balance) / (10 ** decimals);
    
    console.log(`钱包地址: ${wallet.address}`);
    console.log(`${symbol}余额: ${formattedBalance} ${symbol}`);
  } catch (error) {
    console.error('查询代币余额失败:', error.message);
  }
}

// 发送ERC20代币转账
async function sendERC20Transfer() {
  const wallet = loadWallet();
  if (!wallet) {
    console.log('未找到钱包，请先生成钱包');
    return;
  }
  
  try {
    const tokenAddress = await question('请输入ERC20代币合约地址: ');
    const recipient = await question('请输入接收地址: ');
    const amount = await question('请输入转账金额: ');
    
    // 获取代币信息
    const decimals = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'decimals',
    });
    console.log("decimals:", decimals);
    const symbol = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'symbol',
    });
    console.log("symbol:", symbol);
    
    // 转换金额为代币最小单位
    const tokenAmount = BigInt(Math.floor(Number(amount) * (10 ** decimals)));
    
    // 创建钱包客户端用于签名
    // 确保私钥有0x前缀
    const privateKey = wallet.privateKey.startsWith('0x') ? wallet.privateKey : `0x${wallet.privateKey}`;
    const account = privateKeyToAccount(privateKey);
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http('https://1rpc.io/sepolia')
    });
    
    // 获取链上当前gas信息
    const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();
    
    // 构建交易数据 - 使用encodeFunctionData作为独立函数而不是publicClient的方法
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [recipient, tokenAmount]
    });
    
    console.log(`准备发送 ${amount} ${symbol} 到 ${recipient}`);
    const confirm = await question('确认发送? (y/n): ');
    
    if (confirm.toLowerCase() !== 'y') {
      console.log('交易已取消');
      return;
    }
    
    // 发送交易
    const hash = await walletClient.sendTransaction({
      account,
      to: tokenAddress,
      data,
      maxFeePerGas,
      maxPriorityFeePerGas,
    });
    
    console.log(`交易已发送，交易哈希: ${hash}`);
    console.log(`可以在区块浏览器查看: https://sepolia.etherscan.io/tx/${hash}`);
    
    // 等待交易确认
    console.log('等待交易确认...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`交易状态: ${receipt.status === 'success' ? '成功' : '失败'}`);
    
  } catch (error) {
    console.error('发送交易失败:', error.message);
  }
}

// 启动程序
console.log('欢迎使用命令行钱包');
showMenu();
