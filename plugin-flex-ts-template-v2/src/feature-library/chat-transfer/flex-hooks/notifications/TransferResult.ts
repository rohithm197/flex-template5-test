import * as Flex from "@twilio/flex-ui";
import { NotificationType, Notifications } from "@twilio/flex-ui";
import { StringTemplates } from "../strings/ChatTransferStrings";

export enum NotificationIds {
  ChatTransferTaskSuccess = "ChatTransferTaskSuccess",
  ChatParticipantInvited = "ChatParticipantInvited",
  ChatTransferFailedGeneric = "ChatTransferFailed",
  ChatTransferFailedConsultNotSupported = "ChatTransferFailedConsultNotSupported",
  ChatRemoveParticipantFailed = "ChatRemoveParticipantFailed",
}

export default (flex: typeof Flex, manager: Flex.Manager) => {
  chatTransferTaskSuccess();
  chatParticipantInvitedSuccess();
  chatTransferFailedGeneric();
  chatTransferFailedConsultNotSupported();
  chatRemoveParticipantFailed();
};

const chatTransferTaskSuccess = () => {
  Notifications.registerNotification({
    id: NotificationIds.ChatTransferTaskSuccess,
    closeButton: true,
    content: StringTemplates.ChatTransferTaskSuccess,
    timeout: 3000,
    type: NotificationType.success,
  });
};

const chatParticipantInvitedSuccess = () => {
  Notifications.registerNotification({
    id: NotificationIds.ChatParticipantInvited,
    closeButton: true,
    content: StringTemplates.ChatParticipantInvited,
    timeout: 3000,
    type: NotificationType.success,
  });
};

const chatTransferFailedGeneric = () => {
  Notifications.registerNotification({
    id: NotificationIds.ChatTransferFailedGeneric,
    closeButton: true,
    content: StringTemplates.ChatTransferFailedGeneric,
    timeout: 3000,
    type: NotificationType.error,
  });
};

const chatTransferFailedConsultNotSupported = () => {
  Notifications.registerNotification({
    id: NotificationIds.ChatTransferFailedConsultNotSupported,
    closeButton: true,
    content: StringTemplates.ChatTransferFailedConsultNotSupported,
    timeout: 3000,
    type: NotificationType.error,
  });
};

const chatRemoveParticipantFailed = () => {
  Notifications.registerNotification({
    id: NotificationIds.ChatRemoveParticipantFailed,
    closeButton: true,
    content: StringTemplates.ChatRemoveParticipantFailed,
    timeout: 3000,
    type: NotificationType.error,
  });
};
