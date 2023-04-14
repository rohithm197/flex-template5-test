const TokenValidator = require('twilio-flex-token-validator').functionValidator;

const FunctionHelper = require(Runtime.getFunctions()['common/helpers/function-helper'].path);
const TaskOperations = require(Runtime.getFunctions()['common/twilio-wrappers/taskrouter'].path);

exports.handler = TokenValidator(async function updateTaskAttributes(context, event, callback) {
  const response = new Twilio.Response();
  const requiredParameters = [
    { key: 'taskSid', purpose: 'unique ID of task to update' },
    {
      key: 'assignmentStatus',
      purpose: 'Set task to assignemnt status of: pending, reserved, assigned, canceled, wrapping, or completed',
    },
  ];
  const parameterError = FunctionHelper.validateParameters(context.PATH, event, requiredParameters);

  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS POST');
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (Object.keys(event).length === 0) {
    console.log('Empty event object, likely an OPTIONS request');
    return callback(null, response);
  }

  if (parameterError) {
    console.error('update-assignment status invalid parameters passed');
    response.setStatusCode(400);
    response.setBody({ data: null, message: parameterError });
    return callback(null, response);
  }

  try {
    const { taskSid, assignmentStatus } = event;
    const result = await TaskOperations.updateTask({
      context,
      taskSid,
      updateParams: { assignmentStatus },
      attempts: 0,
    });

    const { status, success, message, twilioDocPage, twilioErrorCode } = result;

    response.setStatusCode(status);
    response.setBody({ success, message, twilioDocPage, twilioErrorCode });
    return callback(null, response);
  } catch (error) {
    console.log(error);
    response.setStatusCode(500);
    response.setBody({ data: null, message: error.message });
    return callback(null, response);
  }
});
