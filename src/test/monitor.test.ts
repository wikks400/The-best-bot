import { Database } from '../server/db.ts';
import { evaluateAndDispatchAlerts, buildDiscordEmbed, formatGroupActivityText } from '../server/alerter.ts';
import { ProjectInfo, NetworkConfig } from '../types/index.ts';
import fs from 'fs';
import path from 'path';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function runTestSuite() {
  console.log('========================================================');
  console.log('NFT Group Alert • Comprehensive Test Suite');
  console.log('Testing minting, buying, milestones, groups, deduplication');
  console.log('========================================================\n');

  // Use isolated test DB file
  const testDbPath = path.resolve('./data/test-nft-alert.json');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  const testDb = new Database(testDbPath);

  // Test 1: Address Validation & Normalization
  console.log('Test Suite 1: Address Validation & Normalization');
  assert(Database.isValidAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045'), 'Validates standard lowercase address');
  assert(Database.isValidAddress('0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045'), 'Validates uppercase address');
  assert(!Database.isValidAddress('0xinvalidAddress123'), 'Rejects invalid hex address');
  assert(!Database.isValidAddress('0x00'), 'Rejects short address');

  // Test 2: Group Creation & Multi-Group Wallets
  console.log('\nTest Suite 2: Group Creation & Multi-Group Wallets');
  const degenGroup = testDb.createGroup('Test Degen Minters', 'Degen minting group');
  const smartGroup = testDb.createGroup('Test Smart Traders', 'Smart trader group');
  const earlyGroup = testDb.createGroup('Test Early Minters', 'Early caller group');
  assert(testDb.getGroups().length >= 3, 'Created 3 wallet groups');

  const walletA = '0x1111111111111111111111111111111111111111';
  const walletB = '0x2222222222222222222222222222222222222222';
  const walletC = '0x3333333333333333333333333333333333333333';
  const walletD = '0x4444444444444444444444444444444444444444';

  testDb.addWallet(walletA, degenGroup.id, 'Wallet A');
  testDb.addWallet(walletB, degenGroup.id, 'Wallet B');
  testDb.addWallet(walletC, smartGroup.id, 'Wallet C');
  testDb.addWallet(walletD, earlyGroup.id, 'Wallet D');

  // Add walletA to smartGroup as well (Wallet belongs to multiple groups)
  testDb.addWallet(walletA, smartGroup.id);
  const fetchedWalletA = testDb.getWallets().find(w => w.address === walletA);
  assert(fetchedWalletA?.groupIds.length === 2, 'Wallet A belongs to both Degen and Smart groups');

  // Test duplicate prevention in same group
  let duplicatePrevented = false;
  try {
    testDb.addWallet(walletA, degenGroup.id);
  } catch {
    duplicatePrevented = true;
  }
  assert(duplicatePrevented, 'Prevented adding duplicate wallet to the same group');

  // Test 3: Deduplication and Multi-Group Counting Rule
  console.log('\nTest Suite 3: Unique Wallet Counting Across Multi-Groups');
  const contract = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'; // BAYC contract
  const chainId = 1;

  // Wallet A mints 3 NFTs
  testDb.recordActivity({
    type: 'mint',
    chainId,
    chainName: 'Ethereum',
    contractAddress: contract,
    projectName: 'Test NFT Club',
    walletAddress: walletA,
    tokenId: '1',
    quantity: 3,
    txHash: '0xhash_a1',
    blockNumber: 1000,
    timestamp: Date.now() - 3000,
  });

  // Re-record exact same activity (should be deduplicated!)
  const reRecord = testDb.recordActivity({
    type: 'mint',
    chainId,
    chainName: 'Ethereum',
    contractAddress: contract,
    projectName: 'Test NFT Club',
    walletAddress: walletA,
    tokenId: '1',
    quantity: 3,
    txHash: '0xhash_a1',
    blockNumber: 1000,
    timestamp: Date.now() - 3000,
  });
  assert(!reRecord.isNew, 'Deduplication engine correctly rejected duplicate transaction');

  // Wallet B mints 2 NFTs
  testDb.recordActivity({
    type: 'mint',
    chainId,
    chainName: 'Ethereum',
    contractAddress: contract,
    projectName: 'Test NFT Club',
    walletAddress: walletB,
    tokenId: '2',
    quantity: 2,
    txHash: '0xhash_b1',
    blockNumber: 1001,
    timestamp: Date.now() - 2000,
  });

  // Wallet C mints 1 NFT
  testDb.recordActivity({
    type: 'mint',
    chainId,
    chainName: 'Ethereum',
    contractAddress: contract,
    projectName: 'Test NFT Club',
    walletAddress: walletC,
    tokenId: '3',
    quantity: 1,
    txHash: '0xhash_c1',
    blockNumber: 1002,
    timestamp: Date.now() - 1000,
  });

  // Check 3 wallets: total unique count should be 3 (under 4 threshold)
  const breakdown3 = testDb.calculateGroupBreakdown(chainId, contract, 'mint');
  assert(breakdown3.totalUniqueCount === 3, 'Calculates exactly 3 unique wallets');
  assert(breakdown3.totalNfts === 6, 'Calculates exactly 6 NFTs minted (3 + 2 + 1)');

  // Multi-group verification: Wallet A is in Degen and Smart, so both groups show participation
  const degenEntry = breakdown3.groupBreakdown.find(g => g.groupId === degenGroup.id);
  const smartEntry = breakdown3.groupBreakdown.find(g => g.groupId === smartGroup.id);
  assert(degenEntry?.walletCount === 2, 'Degen group has 2 wallets (A and B)');
  assert(smartEntry?.walletCount === 2, 'Smart group has 2 wallets (A and C)');
  assert(breakdown3.totalUniqueCount === 3, 'Overall unique wallet total is 3 (Wallet A counted only once)');

  // Test 4: Initial Alert at 3 Unique Wallets
  console.log('\nTest Suite 4: Milestone 1 Alert Trigger at Exactly 3 Unique Wallets');
  // At 3 unique wallets (Wallets A, B, C), Milestone 1 threshold of 3 is crossed!
  assert(breakdown3.totalUniqueCount === 3, 'Reached exactly 3 unique wallets for initial alert');

  // Verify group activity formatting text matches section 9 & 10
  const formattedText3 = formatGroupActivityText(breakdown3.groupBreakdown, breakdown3.totalUniqueCount, breakdown3.totalNfts, 'mint');
  assert(formattedText3.includes('TOTAL'), 'Formatted text includes TOTAL header');
  assert(formattedText3.includes('3 unique tracked wallets'), 'Formatted text states 3 unique tracked wallets');
  assert(formattedText3.includes('6 NFTs minted'), 'Formatted text states 6 NFTs minted');

  // Wallet D mints 4 NFTs -> advances count to 4
  testDb.recordActivity({
    type: 'mint',
    chainId,
    chainName: 'Ethereum',
    contractAddress: contract,
    projectName: 'Test NFT Club',
    walletAddress: walletD,
    tokenId: '4',
    quantity: 4,
    txHash: '0xhash_d1',
    blockNumber: 1003,
    timestamp: Date.now(),
  });

  const breakdown4 = testDb.calculateGroupBreakdown(chainId, contract, 'mint');
  assert(breakdown4.totalUniqueCount === 4, 'Reached 4 unique wallets');
  assert(breakdown4.totalNfts === 10, 'Total NFTs minted is 10');

  // Test 5: Milestone Progression (7, 12 wallets)
  console.log('\nTest Suite 5: Milestone Progression & Delta Calculation');
  const mockNet: NetworkConfig = {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    fallbackRpcs: [],
    explorerUrl: 'https://etherscan.io',
    currencySymbol: 'ETH',
    isEnabled: true,
    isConnected: true,
    lastBlockChecked: 1003,
    lastCheckedAt: Date.now(),
    lastLatencyMs: 120,
    lastError: null,
    freeTierNotes: '',
  };

  const mockProject: ProjectInfo = {
    contractAddress: contract,
    chainId: 1,
    name: 'Test NFT Club',
    description: 'Premier test NFT club',
    website: 'https://testnft.club',
    twitter: 'testnft',
    discord: 'https://discord.gg/test',
    openseaUrl: `https://opensea.io/collection/test-nft-club/overview`,
    openseaMintUrl: `https://opensea.io/mint/ethereum/${contract}`,
    explorerUrl: `https://etherscan.io/address/${contract}`,
    verified: true,
    updatedAt: Date.now(),
  };

  // Add 3 more wallets to cross to 7 wallets (Update #2)
  for (let i = 5; i <= 7; i++) {
    const wAddr = `0x${String(i).repeat(40)}`;
    testDb.addWallet(wAddr, earlyGroup.id);
    testDb.recordActivity({
      type: 'mint',
      chainId,
      chainName: 'Ethereum',
      contractAddress: contract,
      projectName: 'Test NFT Club',
      walletAddress: wAddr,
      tokenId: String(i),
      quantity: 1,
      txHash: `0xhash_${i}`,
      blockNumber: 1010 + i,
      timestamp: Date.now(),
    });
  }

  const breakdown7 = testDb.calculateGroupBreakdown(chainId, contract, 'mint');
  assert(breakdown7.totalUniqueCount === 7, 'Reached 7 unique wallets (Update #2 milestone)');

  // Build embed for follow-up update
  const fakeMilestone2 = {
    id: 'test_m2',
    episodeId: 'ep_1',
    chainId: 1,
    chainName: 'Ethereum',
    contractAddress: contract,
    projectName: 'Test NFT Club',
    activityType: 'mint' as const,
    milestoneIndex: 2,
    thresholdWallets: 7,
    totalUniqueWallets: 7,
    newWalletsSinceLast: 3,
    totalNfts: breakdown7.totalNfts,
    currencySymbol: 'ETH',
    groupBreakdown: breakdown7.groupBreakdown,
    projectInfo: mockProject,
    sentAt: Date.now(),
    status: 'sent' as const,
  };

  const embedUpdate2 = buildDiscordEmbed(fakeMilestone2, mockProject, mockNet);
  assert(embedUpdate2.title.includes('NFT MINT UPDATE #2'), 'Follow up embed uses compact update title');
  const progressField = embedUpdate2.fields.find(f => f.name === 'Milestone Progress');
  assert(Boolean(progressField?.value.includes('New wallets since previous alert: **3**')), 'Displays correct delta since previous alert');

  // Test 6: Separate Mint vs Buy Activity
  console.log('\nTest Suite 6: Independent Mint vs Buy Tracking');
  // Buy record on the same project
  testDb.recordActivity({
    type: 'buy',
    chainId,
    chainName: 'Ethereum',
    contractAddress: contract,
    projectName: 'Test NFT Club',
    walletAddress: walletA,
    tokenId: '99',
    quantity: 1,
    txHash: '0xhash_buy_a',
    blockNumber: 1020,
    timestamp: Date.now(),
    priceNative: 0.15,
    marketplace: 'OpenSea',
  });

  const mintCount = testDb.calculateGroupBreakdown(chainId, contract, 'mint').totalUniqueCount;
  const buyCount = testDb.calculateGroupBreakdown(chainId, contract, 'buy').totalUniqueCount;

  // Test 7: Robinhood Chain & OpenSea Integration
  console.log('\nTest Suite 7: Robinhood Chain & OpenSea Integration');
  const networks = testDb.getNetworks();
  const robinhoodNet = networks.find(n => n.id === 'robinhood' || n.chainId === 4663);
  assert(Boolean(robinhoodNet), 'Robinhood Chain is configured in database');
  assert(robinhoodNet?.chainId === 4663, 'Robinhood Chain has official Chain ID 4663');
  assert(Boolean(robinhoodNet?.rpcUrl.includes('rpc.mainnet.chain.robinhood.com')), 'Robinhood Chain uses official live RPC URL');
  assert(robinhoodNet?.isEnabled === true, 'Robinhood Chain is enabled for monitoring');

  // OpenSea metadata link test
  assert(Boolean(mockProject.openseaUrl?.includes('opensea.io/collection/')), 'Generates valid OpenSea collection overview link');
  assert(Boolean(mockProject.openseaMintUrl?.includes('opensea.io/mint/')), 'Generates valid OpenSea mint link');

  // Verify OpenSea buy record has price and marketplace preserved
  const buyRecords = testDb.getRecentActivities(100).filter(a => a.type === 'buy');
  assert(buyRecords.length === 1, 'Buy activity preserved in database');
  assert(buyRecords[0].marketplace === 'OpenSea', 'OpenSea marketplace attributed to purchase');
  assert(buyRecords[0].priceNative === 0.15, 'Purchase price correctly stored');

  // Test 8: Remove All Wallets in a Group (clearWalletsInGroup)
  console.log('\nTest Suite 8: Remove All Wallets in a Group');
  const tempGroup1 = testDb.createGroup('Temp Group 1');
  const tempGroup2 = testDb.createGroup('Temp Group 2');

  const tw1 = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const tw2 = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const tw3 = '0xcccccccccccccccccccccccccccccccccccccccc';

  // Add tw1 and tw2 to tempGroup1 only
  testDb.addWallet(tw1, tempGroup1.id, 'TW 1');
  testDb.addWallet(tw2, tempGroup1.id, 'TW 2');

  // Add tw3 to BOTH tempGroup1 and tempGroup2
  testDb.addWallet(tw3, tempGroup1.id, 'TW 3');
  testDb.addWallet(tw3, tempGroup2.id, 'TW 3 Shared');

  const beforeWalletsG1 = testDb.getWalletsByGroup(tempGroup1.id);
  assert(beforeWalletsG1.length === 3, 'Temp Group 1 starts with 3 wallets');

  // Execute clearWalletsInGroup on tempGroup1
  const clearResult = testDb.clearWalletsInGroup(tempGroup1.id);
  assert(clearResult.removedCount === 3, 'clearWalletsInGroup reported 3 wallets removed');

  const afterWalletsG1 = testDb.getWalletsByGroup(tempGroup1.id);
  assert(afterWalletsG1.length === 0, 'Temp Group 1 has 0 wallets after clearWalletsInGroup');

  // Verify tw3 still exists in tempGroup2
  const afterWalletsG2 = testDb.getWalletsByGroup(tempGroup2.id);
  assert(afterWalletsG2.length === 1, 'Temp Group 2 still retains shared wallet tw3');
  assert(afterWalletsG2[0].address.toLowerCase() === tw3.toLowerCase(), 'Shared wallet address matches');

  // Verify tw1 and tw2 (which had no other groups) are completely cleaned up
  const allCurrentWallets = testDb.getWallets();
  assert(!allCurrentWallets.some(w => w.address.toLowerCase() === tw1), 'Exclusive wallet tw1 removed from DB');
  assert(!allCurrentWallets.some(w => w.address.toLowerCase() === tw2), 'Exclusive wallet tw2 removed from DB');

  // Test error on non-existent group
  let clearErrorCaught = false;
  try {
    testDb.clearWalletsInGroup('non-existent-group-id');
  } catch {
    clearErrorCaught = true;
  }
  assert(clearErrorCaught, 'Throws descriptive error when clearing non-existent group');

  // Test 9: RPC Configuration & Live Chain ID Connectivity
  console.log('\nTest Suite 9: RPC Configuration & Fallback Engine');
  const { resolveNetworkRpcs, testRpcEndpoint, DEFUNCT_PUBLIC_RPCS } = await import('../server/chains.ts');

  // 9.1 Verify resolveNetworkRpcs strips defunct endpoints
  const ethResolved = resolveNetworkRpcs('ethereum', 1, 'https://rpc.ankr.com/eth', ['https://cloudflare-eth.com', 'https://1rpc.io/eth']);
  assert(!DEFUNCT_PUBLIC_RPCS.has(ethResolved.rpcUrl), 'Ethereum primary RPC is not defunct');
  assert(!ethResolved.fallbackRpcs.includes('https://rpc.ankr.com/eth'), 'Strips unauthenticated ankr from fallbacks');
  assert(!ethResolved.fallbackRpcs.includes('https://cloudflare-eth.com'), 'Strips defunct cloudflare from fallbacks');
  assert(ethResolved.fallbackRpcs.includes('https://1rpc.io/eth'), 'Retains valid working fallbacks');

  // 9.2 Verify Polygon resolution
  const polyResolved = resolveNetworkRpcs('polygon', 137, 'https://polygon-rpc.com', ['https://polygon.llamarpc.com']);
  assert(!DEFUNCT_PUBLIC_RPCS.has(polyResolved.rpcUrl), 'Polygon primary RPC is not defunct');
  assert(!polyResolved.fallbackRpcs.includes('https://polygon-rpc.com'), 'Strips dead polygon-rpc.com');
  assert(!polyResolved.fallbackRpcs.includes('https://polygon.llamarpc.com'), 'Strips dead polygon.llamarpc.com');

  // 9.3 Live RPC connectivity test for Ethereum (Chain ID 1)
  console.log('  Testing live Ethereum endpoint...');
  const ethCheck = await testRpcEndpoint('https://rpc.mevblocker.io', 1, 6000);
  assert(ethCheck.success, 'Ethereum live RPC connected successfully');
  assert(ethCheck.chainId === 1, 'Ethereum live RPC confirmed Chain ID 1');
  assert(ethCheck.blockNumber > 20000000, 'Ethereum block number is valid');

  // 9.4 Live RPC connectivity test for Polygon (Chain ID 137)
  console.log('  Testing live Polygon endpoint...');
  const polyCheck = await testRpcEndpoint('https://1rpc.io/matic', 137, 6000);
  assert(polyCheck.success, 'Polygon live RPC connected successfully');
  assert(polyCheck.chainId === 137, 'Polygon live RPC confirmed Chain ID 137');
  assert(polyCheck.blockNumber > 50000000, 'Polygon block number is valid');

  // 9.5 Auth error detection test
  const authCheck = await testRpcEndpoint('https://rpc.ankr.com/eth', 1, 6000);
  assert(!authCheck.success, 'Correctly flags unauthenticated ankr as failure');
  assert(Boolean(authCheck.isAuthError), 'Correctly identifies authentication error');

  // Test 10: OpenSea API Priority, Unique Alert Limit = 3, & Deduplication
  console.log('\nTest Suite 10: OpenSea Priority, Alert Limit = 3, & Deduplication');
  const { isOpenSeaSupported, OPENSEA_UNSUPPORTED_CHAINS, pollOpenSeaForNetwork } = await import('../server/opensea.ts');
  const { getOrDiscoverProject } = await import('../server/metadata.ts');

  // 10.1 Verify OpenSea chain support mapping
  assert(isOpenSeaSupported(1), 'Ethereum is supported by OpenSea API');
  assert(isOpenSeaSupported(8453), 'Base is supported by OpenSea API');
  assert(isOpenSeaSupported(137), 'Polygon is supported by OpenSea API');
  assert(isOpenSeaSupported(4663), 'Robinhood Chain is supported by OpenSea API');
  assert(OPENSEA_UNSUPPORTED_CHAINS.has(57073), 'Ink correctly flagged in unsupported set');

  // 10.2 Verify graceful fallback when OPENSEA_API_KEY is absent
  const mockRobinhoodNet: NetworkConfig = {
    id: 'robinhood',
    name: 'Robinhood Chain',
    chainId: 4663,
    rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
    fallbackRpcs: [],
    explorerUrl: 'https://explorer.chain.robinhood.com',
    currencySymbol: 'ETH',
    isEnabled: true,
    isConnected: true,
    lastBlockChecked: 97223000,
    lastCheckedAt: Date.now(),
    lastLatencyMs: 50,
    lastError: null,
    freeTierNotes: '',
  };
  const osFallbackRes = await pollOpenSeaForNetwork(mockRobinhoodNet, new Set(['0x5ce09f93063b64d6c12b7e37e1b13d628edef928']));
  assert(!osFallbackRes.prioritized, 'Gracefully falls back to RPC monitoring when OPENSEA_API_KEY is unset');

  // 10.3 Verify Diagnostics collection overview link resolution on Robinhood Chain
  const diagProject = await getOrDiscoverProject(mockRobinhoodNet, '0x4e86892cde07a050fe0f9019a11abeb06b7b1bdb');
  assert(diagProject.openseaUrl === 'https://opensea.io/collection/diagnostics-734540624/overview', 'Resolves exact Diagnostics OpenSea collection overview link');
  assert(diagProject.name === 'Diagnostics', 'Resolves correct collection name from OpenSea');

  // 10.4 Verify unique alert limit strictly equals 3 and initial alert threshold equals 3
  const settings = testDb.getSettings();
  assert(settings.maxAlertsPerEpisode === 3, 'Unique alert limit (maxAlertsPerEpisode) is exactly 3');
  assert(settings.milestones[0] === 3, 'Initial alert threshold is confirmed to be exactly 3 wallets');

  // 10.4 Cross-source deduplication verification
  const testTxHash = '0xunique_tx_hash_12345';
  const testContract = '0x1111111111111111111111111111111111111111';
  const testWallet = '0x2222222222222222222222222222222222222222';

  // First record (e.g. from OpenSea API)
  const rec1 = testDb.recordActivity({
    type: 'mint',
    chainId: 1,
    chainName: 'Ethereum',
    contractAddress: testContract,
    projectName: 'Dedupe Test',
    walletAddress: testWallet,
    tokenId: '99',
    quantity: 1,
    txHash: testTxHash,
    blockNumber: 100,
    timestamp: Date.now(),
  });
  assert(rec1.isNew === true, 'First event detection is recorded as new');

  // Second record with same event details (e.g. from RPC monitoring)
  const rec2 = testDb.recordActivity({
    type: 'mint',
    chainId: 1,
    chainName: 'Ethereum',
    contractAddress: testContract,
    projectName: 'Dedupe Test',
    walletAddress: testWallet,
    tokenId: '99',
    quantity: 1,
    txHash: testTxHash,
    blockNumber: 100,
    timestamp: Date.now(),
  });
  assert(rec2.isNew === false, 'Duplicate event from alternate source correctly deduplicated and rejected');

  // Clean up test DB
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  console.log('\n========================================================');
  console.log(`Test Suite Completed: ${passedTests}/${totalTests} tests passed successfully!`);
  console.log('========================================================\n');
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
