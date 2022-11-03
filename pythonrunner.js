const childProcess = require("node:child_process");
const logger = require("./logger");

function startPythonChildProcess(pythonStartedCallback) {
  const pythonProcess = childProcess.spawn("python", ["mt/main.py"]);
  pythonProcess.on("exit", (code, signal) => {
    logger.info("Model Transformation Server exited "
      + ((code===null) ? ("by signal " + signal) : ("with code " + code.toString())));
  });
  const coloredStream = (readableStream, writableStream, colorCode) => {
    readableStream.on("data", chunk => {
      writableStream.write("\x1b["+colorCode+"m"); // set color
      writableStream.write(chunk);
      writableStream.write("\x1b[0m"); // reset color
    });
  };
  // output of Python process is interleaved with output of this process:
  coloredStream(pythonProcess.stdout, process.stdout, "33"); // yellow
  coloredStream(pythonProcess.stderr, process.stderr, "91"); // red

  // Only start the HTTP server after the Transformation Server has started.
  // When the Python process has written the following string to stdout, we know the transformation server has started:
  const expectedString = Buffer.from("Started Model Transformation Server\n");
  let accumulatedOutput = Buffer.alloc(0);
  function pythonOutputListener(chunk) {
    accumulatedOutput = Buffer.concat([accumulatedOutput, chunk]);

    if (accumulatedOutput.length >= expectedString.length) {
      if (accumulatedOutput.subarray(0, expectedString.length).equals(expectedString)) {
        // No need to keep accumulating pythonProcess" stdout:
        pythonProcess.stdout.removeListener("data", pythonOutputListener);

        pythonStartedCallback();
      }
    }
  }
  pythonProcess.stdout.on("data", pythonOutputListener);

  // In case of a forced exit (e.g. uncaught exception), the Python process may still be running, so we force-kill it:
  process.on("exit", code => {
    pythonProcess.kill("SIGKILL");
  });

  return {
    endPythonChildProcess: () => {
      pythonProcess.kill("SIGTERM"); // cleanly exit Python process AFTER http server has shut down.
    },
  };
}

module.exports = { startPythonChildProcess };