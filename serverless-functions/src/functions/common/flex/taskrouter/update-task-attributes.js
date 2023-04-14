const { prepareFlexFunction } = require(Runtime.getFunctions()['common/helpers/function-helper'].path);
const TaskRouterOperations = require(Runtime.getFunctions()['common/twilio-wrappers/taskrouter'].path);

const requiredParameters = [
  { key: 'taskSid', purpose: 'unique ID of task to update' },
  {
    key: 'attributesUpdate',
    purpose: 'object to overwrite on existing task attributes',
  },
];

exports.handler = prepareFlexFunction(requiredParameters, async (context, event, callback, response, handleError) => {
  try {
    const { taskSid, attributesUpdate } = event;
    const result = await TaskRouterOperations.updateTaskAttributes({
      context,
      taskSid,
      attributesUpdate,
      attempts: 0,
    });

    const { status, success, message, twilioDocPage, twilioErrorCode } = result;
    response.setStatusCode(status);
    response.setBody({ success, message, twilioDocPage, twilioErrorCode });
    return callback(null, response);
  } catch (error) {
    return handleError(error);
  }
});
