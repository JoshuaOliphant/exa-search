import {
  Action,
  ActionPanel,
  List,
  getPreferenceValues,
  showToast,
  Toast,
  Icon,
} from "@raycast/api";
import { useState } from "react";
import fetch from "node-fetch";

type Preferences = {
  exaApiKey: string;
};

type ExaSearchResult = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
  published_date?: string;
};

interface ExaSearchResponse {
  results: ExaSearchResult[];
}

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<ExaSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const minQueryLength = 3;

  // Get preferences
  const preferences = getPreferenceValues<Preferences>();

  async function searchExa(query: string) {
    if (!query || query.trim().length < minQueryLength) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": preferences.exaApiKey,
        },
        body: JSON.stringify({
          query: query.trim(),
          num_results: 10,
          use_autoprompt: true,
          include_domains: [],
          exclude_domains: [],
          source_type: "search"
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API error ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as ExaSearchResponse;
      setResults(data.results || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      showToast(Toast.Style.Failure, "Search failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSearchTextChange(newText: string) {
    setSearchText(newText);
    if (!newText.trim()) {
      setResults([]);
    }
  }

  function renderActionPanel() {
    return (
      <ActionPanel>
        <ActionPanel.Section>
          <Action
            title="Search"
            onAction={() => searchExa(searchText)}
            shortcut={{ modifiers: [], key: "return" }}
            icon={Icon.MagnifyingGlass}
          />
          <Action.OpenInBrowser
            title="View Exa API Documentation"
            url="https://docs.exa.ai/reference/search"
            icon={Icon.Document}
          />
        </ActionPanel.Section>
      </ActionPanel>
    );
  }

  function renderEmptyView() {
    if (error) {
      return (
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Error"
          description={error}
        />
      );
    }

    return (
      <List.EmptyView
        icon={Icon.MagnifyingGlass}
        title={
          !searchText.trim()
            ? "Enter your search terms"
            : searchText.trim().length < minQueryLength
            ? `Type at least ${minQueryLength} characters`
            : "Press ↵ to search"
        }
        description="Press ↵ to search"
      />
    );
  }

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={handleSearchTextChange}
      searchBarPlaceholder="Type and press ↵ to search with Exa AI..."
      throttle
      actions={renderActionPanel()}
    >
      {results.length === 0 ? (
        renderEmptyView()
      ) : (
        results.map((item) => (
          <List.Item
            key={item.id}
            icon={Icon.Link}
            title={item.title}
            subtitle={item.snippet}
            accessories={[
              { 
                text: item.published_date 
                  ? new Date(item.published_date).toLocaleDateString() 
                  : undefined 
              }
            ]}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action.OpenInBrowser url={item.url} />
                  <Action.CopyToClipboard
                    content={item.url}
                    title="Copy Link"
                    shortcut={{ modifiers: ["cmd"], key: "c" }}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}