type ToolName =
  | "firecrawlSearch"
  | "gmail_get_or_create_label"
  | "gmail_search_emails"
  | "gmail_create_filter"
  | "gmail_list_filters"
  | "gmail_get_filter"
  | "gmail_update_label"
  | "gmail_delete_label"
  | "gmail_create_filter_from_template"
  | "createExpenseTool"
  | (string & {});

export type { ToolName };
