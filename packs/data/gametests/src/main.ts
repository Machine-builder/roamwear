// Setup logger
import { LogLevel, Logger } from "@bedrock-oss/bedrock-boost";
const loggerMain = Logger.getLogger("main");
Logger.setLevel(LogLevel.All);
loggerMain.debug("Main script is running.");

// Import other required files