import featureFilters from "../../feature-library/*/flex-hooks/teams-filters/*";

export default async (flex, manager) => {
  
  const { roles } = manager.user;
  const loadFilters = roles.indexOf("supervisor") >= 0 || roles.indexOf("admin") >= 0;
  
  if (!loadFilters) return;
  
  let customFilters = [];
  
  for (const file of featureFilters) {
    var addFilters = await file.default();
    customFilters.push(...addFilters);
  }
  
  flex.TeamsView.defaultProps.filters = [
    flex.TeamsView.activitiesFilter,
    ...customFilters
  ];

};
