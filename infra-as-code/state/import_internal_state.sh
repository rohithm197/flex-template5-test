#!/bin/bash
# This script will import the project workflows, queues, channels, activities, and flows for the first time and apply them with Terraform.
set -e

terraform -chdir="../terraform/environments/default" init -input=false

get_value_from_json() {
	input_json="$1"
	key="$2"
	value="$3"
	property="$4"

	filtered_output=$(echo "$input_json" | jq --arg key "$key" --arg value "$value" '.[] | select(.[$key] == $value) // empty' | jq -r ".$property// \"\"")
	echo "$filtered_output"

}

import_resource() {
	input_json="$1"
	name="$2"
	resource="$3"
	key="$4"
	has_sid=${5:-true}

	result=$(get_value_from_json "$input_json" "$key" "$name" "sid")
	if [ -n "$result" ]; then
		if $has_sid; then
			terraform -chdir="../terraform/environments/default" import -input=false -var-file="${ENVIRONMENT:-local}.tfvars" "$resource" "$TF_WORKSPACE_SID"/"$result" || exit
		else
			terraform -chdir="../terraform/environments/default" import -input=false -var-file="${ENVIRONMENT:-local}.tfvars" "$resource" "$result" || exit
		fi
	fi

}

importInternalState() {
	echo " - Discovering and importing existing Twilio state for known definitions into a new terraform state file" >>$GITHUB_STEP_SUMMARY
	workspaces=$(npx twilio api:taskrouter:v1:workspaces:list --no-limit -o json)
	TF_WORKSPACE_SID=$(get_value_from_json "$workspaces" "friendlyName" "Flex Task Assignment" "sid")
	import_resource "$workspaces" "Flex Task Assignment" "twilio_taskrouter_workspaces_v1.flex_task_assignment" "friendlyName" false
	echo "   - :white_check_mark: TaskRouter workspace" >>$GITHUB_STEP_SUMMARY

	workflows=$(npx twilio api:taskrouter:v1:workspaces:workflows:list --workspace-sid "$TF_WORKSPACE_SID" --no-limit -o json | jq 'map(del(.configuration))')
	queues=$(npx twilio api:taskrouter:v1:workspaces:task-queues:list --workspace-sid "$TF_WORKSPACE_SID" --no-limit -o json)
	channels=$(npx twilio api:taskrouter:v1:workspaces:task-channels:list --workspace-sid "$TF_WORKSPACE_SID" --no-limit -o json)
	activities=$(npx twilio api:taskrouter:v1:workspaces:activities:list --workspace-sid "$TF_WORKSPACE_SID" --no-limit -o json)
	flows=$(npx twilio api:studio:v2:flows:list --no-limit -o json)

# FEATURE: remove-all
	import_resource "$workflows" "Template Example" "twilio_taskrouter_workspaces_workflows_v1.template_example" "friendlyName"
	import_resource "$queues" "Everyone" "twilio_taskrouter_workspaces_task_queues_v1.everyone" "friendlyName"
	import_resource "$queues" "Template Example Sales" "twilio_taskrouter_workspaces_task_queues_v1.template_example_sales" "friendlyName"
	import_resource "$queues" "Template Example Support" "twilio_taskrouter_workspaces_task_queues_v1.template_example_support" "friendlyName"
	import_resource "$channels" "voice" "twilio_taskrouter_workspaces_task_channels_v1.voice" "uniqueName"
	echo "   - :white_check_mark: Example TaskRouter resources" >>$GITHUB_STEP_SUMMARY
# END FEATURE: remove-all

# FEATURE: conversation-transfer
	import_resource "$workflows" "Chat Transfer" "module.conversation-transfer.twilio_taskrouter_workspaces_workflows_v1.chat_transfer" "friendlyName"
	echo "   - :white_check_mark: conversation-transfer resources" >>$GITHUB_STEP_SUMMARY
# END FEATURE: conversation-transfer

# FEATURE: callback-and-voicemail
	import_resource "$workflows" "Callback" "module.callback-and-voicemail.twilio_taskrouter_workspaces_workflows_v1.callback" "friendlyName"
	import_resource "$flows" "Example Callback Flow" "module.callback-and-voicemail.twilio_studio_flows_v2.example_callback_flow" "friendlyName" false
	echo "   - :white_check_mark: callback-and-voicemail resources" >>$GITHUB_STEP_SUMMARY
# END FEATURE: callback-and-voicemail

# FEATURE: internal-call
	import_resource "$workflows" "Internal Call" "module.internal-call.twilio_taskrouter_workspaces_workflows_v1.internal_call" "friendlyName"
	import_resource "$queues" "Internal Calls" "module.internal-call.twilio_taskrouter_workspaces_task_queues_v1.internal_calls" "friendlyName"
	echo "   - :white_check_mark: internal-call resources" >>$GITHUB_STEP_SUMMARY
# END FEATURE: internal-call

# FEATURE: activity-reservation-handler
	import_resource "$activities" "On a Task" "module.activity-reservation-handler.twilio_taskrouter_workspaces_activities_v1.on_a_task" "friendlyName"
	import_resource "$activities" "On a Task, No ACD" "module.activity-reservation-handler.twilio_taskrouter_workspaces_activities_v1.on_a_task_no_acd" "friendlyName"
	import_resource "$activities" "Wrap Up" "module.activity-reservation-handler.twilio_taskrouter_workspaces_activities_v1.wrap_up" "friendlyName"
	import_resource "$activities" "Wrap Up, No ACD" "module.activity-reservation-handler.twilio_taskrouter_workspaces_activities_v1.wrap_up_no_acd" "friendlyName"
	echo "   - :white_check_mark: activity-reservation-handler resources" >>$GITHUB_STEP_SUMMARY
# END FEATURE: activity-reservation-handler

# FEATURE: schedule-manager
	import_resource "$flows" "Example Schedule Flow" "module.schedule-manager.twilio_studio_flows_v2.example_schedule_flow" "friendlyName" false
	echo "   - :white_check_mark: schedule-manager resources" >>$GITHUB_STEP_SUMMARY
# END FEATURE: schedule-manager
}

# populate tfvars
(cd ../.. && npm run postinstall -- --skip-packages --files=infra-as-code/terraform/environments/default/example.tfvars)

### only if existing state file does not exist
### do we want to import the internal state
if ! [ -f ../terraform/environments/default/terraform.tfstate ]; then
  importInternalState
fi

terraform -chdir="../terraform/environments/default" apply -input=false -auto-approve -var-file="${ENVIRONMENT:-local}.tfvars"
echo " - Applying terraform configuration complete" >>$GITHUB_STEP_SUMMARY
echo "JOB_FAILED=false" >>"$GITHUB_OUTPUT"
