const { prepareFlexFunction } = require(Runtime.getFunctions()['common/helpers/function-helper'].path);
const VoiceOperations = require(Runtime.getFunctions()['common/twilio-wrappers/programmable-voice'].path);

const requiredParameters = [
  { key: 'conferenceSid', purpose: 'unique ID of conference to resume recording' },
  { key: 'recordingSid', purpose: 'unique ID of recording to resume' },
];

exports.handler = prepareFlexFunction(requiredParameters, async (context, event, callback, response, handleError) => {
  try {
    const { conferenceSid, recordingSid } = event;

    const result = await VoiceOperations.updateConferenceRecording({
      context,
      conferenceSid,
      recordingSid,
      params: {
        status: 'in-progress',
      },
      attempts: 0,
    });

    const { success, recording, status, message, twilioErrorCode, twilioDocPage } = result;

    response.setStatusCode(status);
    response.setBody({ success, recording, message, twilioErrorCode, twilioDocPage });
    return callback(null, response);
  } catch (error) {
    return handleError(error);
  }
});
