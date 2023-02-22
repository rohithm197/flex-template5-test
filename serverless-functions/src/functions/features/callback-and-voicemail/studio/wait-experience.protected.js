/*
 * TwiML for the <Enqueue> waitUrl. Callers will hear the messaging and hold music while in queue to speak to an agent.
 * They can - at any point - press the star key to leave a voicemail and abandon the ongoing call.
 *
 */
const TaskRouterOperations = require(Runtime.getFunctions()[
  "common/twilio-wrappers/taskrouter"
].path);
const VoiceOperations = require(Runtime.getFunctions()[
  "common/twilio-wrappers/programmable-voice"
].path);
const CallbackOperations = require(Runtime.getFunctions()[
  "features/callback-and-voicemail/common/callback-operations"
].path);

const options = {
  sayOptions: { voice: "Polly.Joanna" },
  holdMusicUrl: "/features/callback-and-voicemail/wait-experience-music.mp3",
};

/**
 * Utility function to retrieve all recent pending tasks for the supplied workflow, and find the one that matches our call SID.
 * This avoids the need to use EvaluateTaskAttributes which is strictly rate limited to 3 RPS.
 * @param {*} context
 * @param {*} callSid
 * @param {*} workflowSid
 * @returns
 */
async function getPendingTaskByCallSid(context, callSid, workflowSid) {
  // Limiting to a single max payload size of 50 since the task should be top of the list.
  // Fine tuning of this value can be done based on anticipated call volume and validated through load testing.
  const result = await TaskRouterOperations.getTasks({
    context,
    attempts: 0,
    assignmentStatus: ["pending", "reserved"],
    workflowSid,
    ordering: "DateCreated:desc",
    pageSize: 20,
    limit: 20,
  });

  return result.tasks?.find((task) => task.attributes.call_sid === callSid);
}

/**
 *
 * @param {*} context
 * @param {*} taskSid
 * @returns
 */
async function fetchTask(context, taskSid) {
  const result = await TaskRouterOperations.fetchTask({
    context,
    taskSid,
    attempts: 0,
  });
  return result.task;
}
/**
 * Cancels the task and updates the attributes to reflect the abandoned status.
 * We don't want callbacks or voicemails to contribute to abandoned task metrics.
 *
 * @param {*} context
 * @param {*} task
 * @param {*} cancelReason
 */
async function cancelTask(context, task, cancelReason) {
  const newAttributes = {
    ...task.attributes,
    conversations: {
      ...task.attributes.conversations,
      abandoned: "Follow-Up",
    },
  };

  return await TaskRouterOperations.updateTask({
    context,
    taskSid: task.sid,
    updateParams: {
      assignmentStatus: "canceled",
      reason: cancelReason,
      attributes: JSON.stringify(newAttributes),
    },
    attempts: 0,
  });
}

/**
 * Updates the call with callback or voicemail TwiML URL, and then cancels the ongoing call task with the appropriate reason and attributes.
 *
 * Much of the logic is the same for callback or voicemail, so we're using this single function to handle both.
 *
 * @param {*} context
 * @param {*} isVoicemail
 * @param {*} callSid
 * @param {*} taskSid
 * @returns
 */
async function handleCallbackOrVoicemailSelected(
  context,
  isVoicemail,
  callSid,
  taskSid
) {
  const domain = `https://${context.DOMAIN_NAME}`;
  const twiml = new Twilio.twiml.VoiceResponse();

  const cancelReason = isVoicemail
    ? "Opted to leave a voicemail"
    : "Opted to request a callback";
  const mode = isVoicemail ? "record-voicemail" : "submit-callback";

  const task = await fetchTask(context, taskSid);

  // Redirect Call to callback or voicemail logic. We need to update the call with a new TwiML URL vs using twiml.redirect() - since
  // we are still in the waitUrl TwiML execution - and it's not possible to use the <Record> verb in here. We piggyback on the same approach for callbacks,
  // though technically these could be handled entirely in the waitUrl TwiML
  const redirectUrl = `${domain}/features/callback-and-voicemail/studio/wait-experience?mode=${mode}&CallSid=${callSid}&enqueuedTaskSid=${taskSid}`;
  const result = await VoiceOperations.updateCall({
    context,
    callSid,
    params: { method: "POST", url: redirectUrl },
    attempts: 0,
  });
  const { success, status } = result;

  if (success) {
    //  Cancel (update) the task with handy attributes for reporting
    await cancelTask(context, task, cancelReason);
  } else {
    console.error(
      `Failed to update call ${callSid} with new TwiML. Status: ${status}`
    );
    twiml.say(
      sayOptions,
      "Sorry, we were unable to perform this operation. Please remain on the line."
    );
    twiml.redirect(
      `${domain}/features/callback-and-voicemail/studio/wait-experience?mode=main-wait-loop&CallSid=${callSid}&enqueuedTaskSid=${taskSid}&skipGreeting=true`
    );
    return twiml;
  }
  return "";
}

exports.handler = async function (context, event, callback) {
  const domain = `https://${context.DOMAIN_NAME}`;
  const twiml = new Twilio.twiml.VoiceResponse();

  // Retrieve options
  const { sayOptions, holdMusicUrl } = options;

  const {
    Digits,
    CallSid,
    enqueuedWorkflowSid,
    mode,
    enqueuedTaskSid,
    skipGreeting,
  } = event;

  let message = "";

  switch (mode) {
    case "initialize":
      // Initial logic to find the associated task for the call, and propagate it through to the rest of the TwiML execution
      // If the lookup fails to find the task, the remaining TwiML logic will not offer any callback or voicemail options.
      const enqueuedTask = await getPendingTaskByCallSid(
        context,
        CallSid,
        enqueuedWorkflowSid
      );

      const redirectUrlNoTaskFound = `${domain}/features/callback-and-voicemail/studio/wait-experience?mode=main-wait-loop&CallSid=${CallSid}`;

      if (enqueuedTask == null) {
        // Log an error for our own debugging purposes, but don't fail the call
        console.error(
          `Failed to find the pending task with callSid: ${CallSid}. This is potentially due to higher call volume than the API query had accounted for.`
        );
        twiml.redirect(redirectUrlNoTaskFound);
      } else {
        twiml.redirect(
          redirectUrlNoTaskFound +
            (enqueuedTask ? `&enqueuedTaskSid=${enqueuedTask.sid}` : "")
        );
      }
      return callback(null, twiml);

    case "main-wait-loop":
      if (skipGreeting !== "true") {
        const initGreeting =
          "Please wait while we direct your call to the next available specialist.";
        twiml.say(sayOptions, initGreeting);
      }
      if (enqueuedTaskSid != null) {
        message =
          "To request a callback, or to leave a voicemail, press the star key at anytime... Otherwise, please continue to hold";
        // Nest the <Say>/<Play> within the <Gather> to allow the caller to press a key at any time during the nested verbs' execution.
        const initialGather = twiml.gather({
          input: "dtmf",
          timeout: "2",
          action: `${domain}/features/callback-and-voicemail/studio/wait-experience?mode=handle-initial-choice&CallSid=${CallSid}&enqueuedTaskSid=${enqueuedTaskSid}`,
        });
        initialGather.say(sayOptions, message);
        initialGather.play(domain + holdMusicUrl);
      } else {
        // If the task lookup failed to find the task previously, don't offer callback or voicemail options - since we aren't able to cancel
        // the ongoing call task
        message =
          "The option to request a callback or leave a voicemail is not available at this time. Please continue to hold.";
        twiml.say(sayOptions, message);
        twiml.play(domain + holdMusicUrl);
      }
      // Loop back to the start if we reach this point
      twiml.redirect(
        `${domain}/features/callback-and-voicemail/studio/wait-experience?mode=main-wait-loop&CallSid=${CallSid}&enqueuedTaskSid=${enqueuedTaskSid}&skipGreeting=true`
      );
      return callback(null, twiml);

    case "handle-initial-choice":
      // If the caller pressed the star key, prompt for callback or voicemail
      if (Digits === "*") {
        message =
          "To request a callback when a representative becomes available, press 1. \
          To leave a voicemail for the next available representative, press 2. \
          To continue holding, press any other key, or remain on the line.";
        // Nest the <Say>/<Play> within the <Gather> to allow the caller to press a key at any time during the nested verbs' execution.
        const callbackOrVoicemailGather = twiml.gather({
          input: "dtmf",
          timeout: "2",
          action: `${domain}/features/callback-and-voicemail/studio/wait-experience?mode=handle-callback-or-voicemail-choice&CallSid=${CallSid}&enqueuedTaskSid=${enqueuedTaskSid}`,
        });
        callbackOrVoicemailGather.say(sayOptions, message);
      }

      // Loop back to the start of the wait loop
      twiml.redirect(
        `${domain}/features/callback-and-voicemail/studio/wait-experience?mode=main-wait-loop&CallSid=${CallSid}&enqueuedTaskSid=${enqueuedTaskSid}&skipGreeting=true`
      );
      return callback(null, twiml);

    case "handle-callback-or-voicemail-choice":
      if (Digits === "1" || Digits === "2") {
        // 1 = callback, 2 = voicemail
        const isVoicemail = Digits === "2";
        return callback(
          null,
          await handleCallbackOrVoicemailSelected(
            context,
            isVoicemail,
            CallSid,
            enqueuedTaskSid
          )
        );
      }

      // Loop back to the start of the wait loop if the caller pressed any other key
      twiml.redirect(
        `${domain}/features/callback-and-voicemail/studio/wait-experience?mode=main-wait-loop&CallSid=${CallSid}&enqueuedTaskSid=${enqueuedTaskSid}&skipGreeting=true`
      );
      return callback(null, twiml);

    case "submit-callback":
      // Create the Callback task
      // Option to pull in a few more things from original task like conversation_id or even the workflowSid
      await CallbackOperations.createCallbackTask({
        context,
        numberToCall: event.Caller,
        numberToCallFrom: event.Called,
      });

      // End the interaction. Hangup the call.
      twiml.say(
        sayOptions,
        "Your callback has been successfully requested. You will receive a call shortly. Goodbye."
      );
      twiml.hangup();
      return callback(null, twiml);

    case "record-voicemail":
      //  Main logic for Recording the voicemail
      twiml.say(
        sayOptions,
        "Please leave a message at the tone.  Press the star key when finished."
      );
      twiml.record({
        action: `${domain}/features/callback-and-voicemail/studio/wait-experience?mode=voicemail-recorded&CallSid=${CallSid}&enqueuedTaskSid=${enqueuedTaskSid}`,
        transcribeCallback: `${domain}/features/callback-and-voicemail/studio/wait-experience?mode=submit-voicemail&CallSid=${CallSid}&enqueuedTaskSid=${enqueuedTaskSid}`,
        method: "GET",
        playBeep: "true",
        transcribe: true,
        timeout: 10,
        finishOnKey: "*",
      });
      twiml.say(sayOptions, "We weren't able to capture your message.");
      twiml.redirect(
        `${domain}/features/callback-and-voicemail/studio/wait-experience?mode=record-voicemail&CallSid=${CallSid}&enqueuedTaskSid=${enqueuedTaskSid}`
      );
      return callback(null, twiml);

    case "voicemail-recorded":
      // End the interaction. Hangup the call.
      twiml.say(
        sayOptions,
        "Your voicemail has been successfully recorded... Goodbye"
      );
      twiml.hangup();
      return callback(null, twiml);

    case "submit-voicemail":
      // Submit the voicemail to Taskrouter (and/or to your backend if you have a voicemail handling solution)

      // Create the Voicemail task
      // Option to pull in a few more things from original task like conversation_id or even the workflowSid

      await CallbackOperations.createCallbackTask({
        context,
        numberToCall: event.Caller,
        numberToCallFrom: event.Called,
        recordingSid: event.RecordingSid,
        recordingUrl: event.RecordingUrl,
        transcriptSid: event.TranscriptionSid,
        transcriptText: event.TranscriptionText,
      });

      return callback(null, "");

    default:
      //  Default case - if we don't recognize the mode, redirect to the main wait loop
      twiml.say(
        sayOptions,
        "Sorry, we were unable to perform this operation. Please remain on the line."
      );
      twiml.redirect(
        `${domain}/features/callback-and-voicemail/studio/wait-experience?mode=main-wait-loop&CallSid=${CallSid}&enqueuedTaskSid=${enqueuedTaskSid}&skipGreeting=true`
      );
      return callback(null, twiml);
  }
};