#!/usr/bin/env node

import { createPublicClient, http, formatEther, decodeAbiParameters } from 'viem';
import { sepolia } from 'viem/chains';
import { keccak256, toHex, padHex, hexToBigInt } from 'viem';

// 连接到以太坊网络
const publicClient = createPublicClient({
  chain: sepolia,
//   transport: http('https://1rpc.io/sepolia') // 使用公共RPC节点
  transport: http('http://172.17.93.72:8545') // 使用公共RPC节点
});

// 合约地址 - 需要替换为实际的合约地址
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // 请替换为实际esRNT合约地址

// 读取并解析_locks数组
async function readLocks() {
  try {
    // 1. 获取数组长度 (_locks存储在slot 0)
    const lengthSlot = 0; // _locks是合约中的第一个状态变量，所以存储在slot 0
    const lengthData = await publicClient.getStorageAt({
      address: CONTRACT_ADDRESS,
      slot: toHex(lengthSlot),
    });
    
    const length = hexToBigInt(lengthData);
    console.log(`_locks数组长度: ${length}`);
    
    // 2. 计算数组数据的起始位置
    // 动态数组数据的起始位置 = keccak256(数组存储槽)
    const arrayDataSlot = keccak256(padHex(toHex(lengthSlot), { size: 32 }));
    
    // 3. 读取每个LockInfo结构体
    // LockInfo结构体: {address user; uint64 startTime; uint256 amount;}
    for (let i = 0n; i < length; i++) {
      // 计算当前元素的存储位置
      // 每个LockInfo结构体占用2个存储槽:
      // 槽1: address user (20字节) + uint64 startTime (8字节) = 28字节 < 32字节，所以放在一个槽中
      // 槽2: uint256 amount (32字节)
      const elementPosition = hexToBigInt(arrayDataSlot) + i * 2n;
      
      // 读取第一个槽 (user和startTime)
      const slot1Data = await publicClient.getStorageAt({
        address: CONTRACT_ADDRESS,
        slot: toHex(elementPosition),
      });
      
      // 读取第二个槽 (amount)
      const slot2Data = await publicClient.getStorageAt({
        address: CONTRACT_ADDRESS,
        slot: toHex(elementPosition + 1n),
      });
      
      // 解析user和startTime
      // slot1Data前20字节是地址，后8字节是startTime
      const user = `0x${slot1Data.slice(26, 66)}`;
      const startTimeHex = `0x${slot1Data.slice(10, 26)}`;
      const startTime = hexToBigInt(startTimeHex);
      
      // 解析amount (完整的第二个槽)
      const amount = hexToBigInt(slot2Data);
      
      // 格式化并打印结果
      console.log(`locks[${i}]: user: ${user}, startTime: ${startTime}, amount: ${formatEther(amount)} RNT`);
    }
  } catch (error) {
    console.error('读取_locks数组失败:', error.message);
  }
}

// 执行主函数
console.log('开始读取esRNT合约中的_locks数组...');
readLocks();
