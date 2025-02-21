const { network, ethers } = require("hardhat");
const {
  networkConfig,
  developmentChains,
  VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const FUND_AMOUNT = 1e18; // ethers.utils.parseEther("1"); // 1 Ether, or 1e18 (10^18) Wei

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const namedAccounts = await getNamedAccounts();
  //console.log("Named Accounts:", namedAccounts);
  //console.log("Deployer Address:", namedAccounts.deployer);

  const chainId = network.config.chainId;
  let vrfCoordinatorV2Address,
    subscriptionId,
    vrfCoordinatorV2Mock,
    VRFCoordinatorV2Mock;

  if (developmentChains.includes(network.name)) {
    // create VRFV2 Subscription
    vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    console.log("VRFCoordinatorV2Mock Contract: ", vrfCoordinatorV2Mock);

    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;

    // youtube 15:14:54

    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
    console.log("transactionResponse.wait:", typeof transactionResponse.wait);

    console.log("subscription created: ", transactionResponse);

    const transactionReceipt = await transactionResponse.wait(10);
    console.log("transactionReceipt created: ", transactionReceipt.events);

    subscriptionId = transactionReceipt.events[1].args.subId;
    // Fund the subscription
    // Our mock makes it so we don't actually have to worry about sending fund
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT);
  } else {
    console.log("chain ID for 01 deploy: ", chainId);
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }
  const waitBlockConfirmations = developmentChains.includes(network.name)
    ? 1
    : VERIFICATION_BLOCK_CONFIRMATIONS;

  log("----------------------------------------------------");
  const arguments = [
    vrfCoordinatorV2Address,
    subscriptionId,
    networkConfig[chainId]["gasLane"],
    networkConfig[chainId]["keepersUpdateInterval"],
    networkConfig[chainId]["raffleEntranceFee"],
    networkConfig[chainId]["callbackGasLimit"],
  ];
  const raffle = await deploy("Raffle", {
    from: deployer,
    args: arguments,
    log: true,
    waitConfirmations: waitBlockConfirmations,
  });

  // Ensure the Raffle contract is a valid consumer of the VRFCoordinatorV2Mock contract.
  if (developmentChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract(
      "VRFCoordinatorV2Mock"
    );
    await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address);
  }

  // Verify the deployment
  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("Verifying...");
    await verify(raffle.address, arguments);
  }

  log("Enter lottery with command:");
  const networkName = network.name == "hardhat" ? "localhost" : network.name;
  log(`yarn hardhat run scripts/enterRaffle.js --network ${networkName}`);
  log("----------------------------------------------------");
};

module.exports.tags = ["all", "raffle"];
