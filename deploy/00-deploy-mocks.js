const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const BASE_FEE = "250000000000000000";
const GAS_PRICE_LINK = 1e9; // link per gas

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const args = [BASE_FEE, GAS_PRICE_LINK];

  const chainId = network.config.chainId;
  if (developmentChains.includes(network.name)) {
    log("Local network detected! Deploying mocks...");
    // deploy a mock vrfCoordinator
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: args,
    });
    log("Mock Deployed!");
    log("--------------------------------------------------");
  }
};

module.exports.tags = ["all", "mocks"];
