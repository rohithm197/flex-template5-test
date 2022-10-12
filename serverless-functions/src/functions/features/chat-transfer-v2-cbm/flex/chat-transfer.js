const TokenValidator = require("twilio-flex-token-validator").functionValidator;
const ParameterValidator = require(Runtime.getFunctions()[
  "common/helpers/parameter-validator"
].path);
const TaskOperations = require(Runtime.getFunctions()[
  "common/twilio-wrappers/taskrouter"
].path);
const InteractionsOperations = require(Runtime.getFunctions()[
  "common/twilio-wrappers/interactions"
].path);

const getRequiredParameters = (event) => {
  const requiredParameters = [
    {
      key: "taskSid",
      purpose: "task sid of transferring task",
    },
    {
      key: "conversationId",
      purpose: "for linking transfer task in insights (CHxxx or WTxxx sid)",
    },
    {
      key: "jsonAttributes",
      purpose: "string representation of transferring task",
    },
    {
      key: "transferTargetSid",
      purpose: "worker or queue sid",
    },
    {
      key: "transferQueueName",
      purpose:
        "friendly name of taskrouter queue - can be empty string if transferTargetSid is a worker sid",
    },
    {
      key: "ignoreWorkerContactUri",
      purpose:
        "contact_uri from workers attributes that transferred the task. we don't want to give them back the transferred task",
    },
    {
      key: "flexInteractionSid",
      purpose: "KDxxx sid for inteactions API",
    },
    {
      key: "flexInteractionChannelSid",
      purpose: "UOxxx sid for interactions API",
    },
    {
      key: "flexInteractionParticipantSid",
      purpose:
        "UTxxx sid for interactions API for the transferrring agent to remove them from conversation",
    },
  ];
  return requiredParameters;
};

const getRoutingParams = (
  context,
  conversationId,
  jsonAttributes,
  transferTargetSid,
  transferQueueName,
  ignoreWorkerContactUri
) => {
  const originalTaskAttributes = JSON.parse(jsonAttributes);
  const newAttributes = {
    ...originalTaskAttributes,
    ignoreWorkerContactUri,
    transferTargetSid,
    transferQueueName,
    transferTargetType: transferTargetSid.startsWith("WK") ? "worker" : "queue",
    conversations: {
      ...originalTaskAttributes.conversations,
      conversation_id: conversationId,
    },
  };

  const routingParams = {
    properties: {
      task_channel_unique_name: "chat",
      workspace_sid: context.TWILIO_FLEX_WORKSPACE_SID,
      workflow_sid: context.TWILIO_FLEX_CHAT_TRANSFER_WORKFLOW_SID,
      attributes: newAttributes,
    },
  };

  return routingParams;
};

exports.handler = TokenValidator(async function chat_transfer_v2_cbm(
  context,
  event,
  callback
) {
  const scriptName = arguments.callee.name;
  const response = new Twilio.Response();

  const requiredParameters = getRequiredParameters(event);
  const parameterError = ParameterValidator.validate(
    context.PATH,
    event,
    requiredParameters
  );

  response.appendHeader("Access-Control-Allow-Origin", "*");
  response.appendHeader("Access-Control-Allow-Methods", "OPTIONS POST");
  response.appendHeader("Content-Type", "application/json");
  response.appendHeader("Access-Control-Allow-Headers", "Content-Type");

  if (Object.keys(event).length === 0) {
    console.log("Empty event object, likely an OPTIONS request");
    return callback(null, response);
  }

  if (
    !context.TWILIO_FLEX_WORKSPACE_SID ||
    !context.TWILIO_FLEX_CHAT_TRANSFER_WORKFLOW_SID
  ) {
    response.setStatusCode(400);
    response.setBody({
      data: null,
      message:
        "TWILIO_FLEX_WORKSPACE_SID and TWILIO_FLEX_CHAT_TRANSFER_WORKFLOW_SID required enviroment variables",
    });
    callback(null, response);
  }

  if (parameterError) {
    response.setStatusCode(400);
    response.setBody({ data: null, message: parameterError });
    callback(null, response);
  } else {
    try {
      const {
        conversationId,
        jsonAttributes,
        transferTargetSid,
        transferQueueName,
        ignoreWorkerContactUri,
        flexInteractionSid,
        flexInteractionChannelSid,
        flexInteractionParticipantSid,
      } = event;

      const routingParams = getRoutingParams(
        context,
        conversationId,
        jsonAttributes,
        transferTargetSid,
        transferQueueName,
        ignoreWorkerContactUri
      );

      const participantCreateInviteParams = {
        routing: routingParams,
        interactionSid: flexInteractionSid,
        channelSid: flexInteractionChannelSid,
        context,
        scriptName,
        attempts: 0,
      };

      let {
        success,
        status,
        message = "",
        participantInvite = null,
      } = await InteractionsOperations.participantCreateInvite(
        participantCreateInviteParams
      );

      // if this failed bail out so we don't remove the agent from the conversation and no one else joins
      if (!success) {
        return sendErrorReply(callback, response, scriptName, status, message);
      }

      // await InteractionsOperations.participantUpdate({
      //   status: "closed",
      //   interactionSid: flexInteractionSid,
      //   channelSid: flexInteractionChannelSid,
      //   participantSid: flexInteractionParticipantSid,
      //   scriptName,
      //   context,
      //   attempts: 0,
      // });

      response.setStatusCode(201);
      response.setBody({
        success: true,
        message: `Participant invite ${participantInvite.sid}`,
      });
      callback(null, response);
    } catch (error) {
      console.error(`Unexpected error occurred in ${scriptName}: ${error}`);
      response.setStatusCode(500);
      response.setBody({ success: false, message: error });
      callback(null, response);
    }
  }
});

const sendErrorReply = (callback, response, scriptName, status, message) => {
  console.error(`Unexpected error occurred in ${scriptName}: ${message}`);
  response.setStatusCode(status);
  response.setBody({ success: false, message });
  callback(null, response);
};
