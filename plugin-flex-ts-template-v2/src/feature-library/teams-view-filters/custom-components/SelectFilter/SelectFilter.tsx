import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { styled } from '@twilio/flex-ui';
import { Select, Option } from '@twilio-paste/core/select';
import { Stack } from '@twilio-paste/core/stack';
import { useFormPillState, FormPillGroup, FormPill } from '@twilio-paste/core/form-pill-group';

import { FilterDefinitionOption } from '../../types/FilterDefinitionOption';
import AppState from '../../../../types/manager/AppState';
import { reduxNamespace } from '../../../../utils/state';
import { QueueNoWorkerDataFilterState } from '../../flex-hooks/states/QueueNoWorkerDataFilterSlice';

const FilterContainer = styled('div')`
  margin-left: 16px;
`;

export type OwnProps = {
  handleChange?: (newValue: Array<any> | string) => unknown;
  options?: Array<FilterDefinitionOption>;
  name?: string;
  currentValue?: string[];
  IsMulti: boolean;
};

export const MultiSelectFilter = (props: OwnProps) => {
  const pillState = useFormPillState();
  const [selectedItems, setSelectedItems] = useState([] as string[]);
  
  const { selectedQueue } = useSelector(
    (state: AppState) => state[reduxNamespace].queueNoWorkerDataFilter as QueueNoWorkerDataFilterState,
  );
  
  useEffect(() => {
    if (props.handleChange) {
      props.handleChange(selectedItems);
    }
  }, [selectedItems]);

  useEffect(() => {
    if (!props.currentValue) {
      // This is a bit of a hack to enable the queueNoWorkerDataFilter to render the currently filtered queue accurately.
      // Because that filter actually applies skill filters instead via logic in beforeApplyTeamsViewFilters,
      // our component's value is 'reset' by Flex. The beforeApplyTeamsViewFilters logic saves and resets the selected queue
      // in state, so we can rely on that to know when to persist the selected queue versus when to actually reset.
      // The name 'queue' is unique to the queueNoWorkerDataFilter (queueWorkerDataFilter uses the name 'queues' instead).
      if (props.name === 'queue' && selectedQueue !== '') {
        setSelectedItems([selectedQueue]);
        return;
      }
      
      setSelectedItems([]);
    }
  }, [props.currentValue]);

  const elementId = `${props.name}-select`;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!e.target.value) return;

    if (props.IsMulti) {
      setSelectedItems((selectedItems) => [...selectedItems, e.target.value]);
    } else {
      setSelectedItems([e.target.value]);
    }
  };

  const deselectItem = (item: FilterDefinitionOption) => {
    setSelectedItems((selectedItems) => [...selectedItems.filter((i) => i !== item.value)]);
  };

  return (
    <FilterContainer>
      <Stack orientation="vertical" spacing="space30">
        <Select
          id={elementId}
          onChange={handleChange}
          value={props.IsMulti ? 'placeholder' : selectedItems.length === 1 ? selectedItems[0] : 'placeholder'}
        >
          <Option disabled={true} key="placeholder" value="placeholder">
            {props.IsMulti ? 'Select one or more items...' : 'Select an item...'}
          </Option>
          {props.options
            ? props.options.map((item: FilterDefinitionOption) => {
                const selectedItem = selectedItems.find((i) => i === item.value);
                if (props.IsMulti && selectedItem) return null;
                return (
                  <Option value={item.value} key={item.value}>
                    {item.label}
                  </Option>
                );
              })
            : {}}
        </Select>
        {props.IsMulti && (
          <FormPillGroup {...pillState} aria-label="Selected items:">
            {selectedItems.map((item) => {
              const filterItem = props.options?.find((i) => i.value === item);
              if (!filterItem) return null;
              return (
                <FormPill
                  key={filterItem.value}
                  {...pillState}
                  onDismiss={() => {
                    deselectItem(filterItem);
                  }}
                >
                  {filterItem.label}
                </FormPill>
              );
            })}
          </FormPillGroup>
        )}
      </Stack>
    </FilterContainer>
  );
};

export default MultiSelectFilter;
