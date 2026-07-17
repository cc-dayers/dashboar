For the Pr Review report, can we:

1. For the average Review time, can we make sure to track this over time as well? Then we can also in the top KPI card, can show an indicator for which direction we are trending
2. For an individual review item view, The title is the first datapoint which is good, but we should take a crack at organizing the data better at the top. We should have a labels for the datapoints, and also make sure to have buttons for both the Jira Ticket, and the bitbucket PR so that the user can easily click it and go right there.
3. For the list element that lists the individual review item in the sidebar, can we mak sure to include what release the PR was targeted at right after the PR # ie 1152 -> release/6.30

Generally:
1. can we take a pass at ensuring that we are re-using components for the reports as much as possible and not hand coding react UI's from scratch for every report?

For the landing page / dashboar dashboard:
1. Can we make sure that we are not unloading the DOM content when we refresh? We should be putting up the loading overlay, not making it so the items underneat dissapear and re-appear
2. Can we simplify the view of the reports? I think the schema concept is good but it confuses things having the different versions that the user can click on, as well as the examples and "future". This seems like it should just be removed. Or actually perhaps under a sort of 'advanced options', or probably better a "previous versions" expander / toggle.
3. Can we build out a distinct "docs" view. This will allow a user to configure a docs page for any report, as well as house docs for the dashboar in general. A doc should just be a markdown file, and we need to write a robust one to start. When the user hits a help button / icon on the landing page (we should also add this docs button as a always there item in the lower right of the screen. This is similar to our "<>JSON" button that can be clicked to view the raw JSON. Actually Now that I think of it that should be in the lower right as well. So we would be looking at JSON on top, and the Docs button underneath that.

e2e-aggregate report
1. I don't know what this is, and it doesn't work when clicked. The dashboard says 3 in storage right now, but that fourth report has no items and so really is just confusing things, and more than that it just errors out when being viewed. Can we see who added this report, and if it was me, then lets just delete it.
