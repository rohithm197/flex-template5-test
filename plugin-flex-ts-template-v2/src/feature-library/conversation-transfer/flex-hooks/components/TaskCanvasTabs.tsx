import * as Flex from '@twilio/flex-ui';
import { isMultiParticipantEnabled } from '../../config'
import { Tab, TaskHelper } from "@twilio/flex-ui"
import { ParticipantTabLabel } from "../../custom-components/ParticipantTabLabel"
import ParticipantsTab from "../../custom-components/ParticipantsTab"
import { FlexComponent } from "../../../../types/feature-loader";

interface Props {
    task : Flex.ITask
}

export const componentName = FlexComponent.TaskCanvasTabs;
export const componentHook = function addTaskCanvasTabCustomization(flex: typeof Flex) {
    if (!isMultiParticipantEnabled()) return;

    flex.TaskCanvasTabs.Content.add(
        <Tab label={ParticipantTabLabel()} key="participant-tab"><ParticipantsTab /></Tab>,
      { if: ({task} : Props) => TaskHelper.isCBMTask(task) && task.status === "accepted" }
    )
}
