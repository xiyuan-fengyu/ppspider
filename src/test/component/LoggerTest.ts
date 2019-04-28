import {logger} from "../../common/util/logger";

logger.debugValid && logger.debug("debug test");

logger.infoValid && logger.info("info test");

logger.warnValid && logger.warn("warn test");

logger.errorValid && logger.error("error test", new Error("just test"));
