//go:build integration

package prismer_test

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	prismer "github.com/prismer-io/prismer-sdk-go"
)

// imMessageLoose works around a SDK bug where IMMessage.Metadata is typed as
// map[string]any but the API can return a JSON string for that field.
// See SDK bug report in test summary.
type imMessageLoose struct {
	ID        string          `json:"id"`
	Content   string          `json:"content"`
	Type      string          `json:"type"`
	SenderID  string          `json:"senderId"`
	CreatedAt string          `json:"createdAt"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
}

// helpers ---------------------------------------------------------------

func apiKey(t *testing.T) string {
	t.Helper()
	key := os.Getenv("PRISMER_API_KEY_TEST")
	if key == "" {
		t.Fatal("PRISMER_API_KEY_TEST environment variable is required")
	}
	return key
}

func newClient(t *testing.T) *prismer.Client {
	t.Helper()
	return prismer.NewClient(apiKey(t), prismer.WithEnvironment(prismer.Production))
}

func uniqueName(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

// =======================================================================
// Group 1: Context API
// =======================================================================

func TestIntegration_Context_LoadSingle(t *testing.T) {
	client := newClient(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := client.Load(ctx, "https://example.com", nil)
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if !result.Success {
		t.Fatalf("Load was not successful: %+v", result.Error)
	}
	if result.Mode == "" {
		t.Error("expected non-empty Mode")
	}
	t.Logf("Load single — mode=%s requestId=%s", result.Mode, result.RequestID)

	// In single mode we expect Result to be populated
	if result.Result == nil && len(result.Results) == 0 {
		t.Error("expected at least Result or Results to be populated")
	}
}

func TestIntegration_Context_LoadBatch(t *testing.T) {
	client := newClient(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	urls := []string{"https://example.com", "https://httpbin.org/html"}
	result, err := client.Load(ctx, urls, nil)
	if err != nil {
		t.Fatalf("Load batch returned error: %v", err)
	}
	if !result.Success {
		t.Fatalf("Load batch was not successful: %+v", result.Error)
	}
	t.Logf("Load batch — mode=%s results=%d", result.Mode, len(result.Results))

	if result.Mode != "batch_urls" {
		t.Errorf("expected mode=batch_urls, got %s", result.Mode)
	}
	if len(result.Results) == 0 {
		t.Error("expected non-empty Results for batch load")
	}
}

func TestIntegration_Context_Save(t *testing.T) {
	client := newClient(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	saveURL := fmt.Sprintf("https://test.example.com/go-integration-%d", time.Now().UnixNano())
	result, err := client.Save(ctx, &prismer.SaveOptions{
		URL:  saveURL,
		HQCC: "Integration test content from Go SDK.",
	})
	if err != nil {
		t.Fatalf("Save returned error: %v", err)
	}
	if !result.Success {
		t.Fatalf("Save was not successful: %+v", result.Error)
	}
	t.Logf("Save — status=%s url=%s", result.Status, result.URL)
}

// =======================================================================
// Group 2: Parse API
// =======================================================================

func TestIntegration_Parse_PDF(t *testing.T) {
	client := newClient(t)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	result, err := client.ParsePDF(ctx, "https://arxiv.org/pdf/2301.00234.pdf", "fast")
	if err != nil {
		t.Fatalf("ParsePDF returned error: %v", err)
	}
	if !result.Success {
		t.Fatalf("ParsePDF was not successful: %+v", result.Error)
	}
	t.Logf("ParsePDF — requestId=%s mode=%s taskId=%s async=%v",
		result.RequestID, result.Mode, result.TaskID, result.Async)

	// Depending on async mode, we might get a taskId or a document
	if result.RequestID == "" && result.TaskID == "" {
		t.Error("expected either requestId or taskId to be set")
	}
}

// =======================================================================
// Group 3: IM API — Full Lifecycle
// =======================================================================

func TestIntegration_IM_FullLifecycle(t *testing.T) {
	apiClient := newClient(t)
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	ts := time.Now().UnixNano()

	// ---------------------------------------------------------------
	// 3.1  Register agent A
	// ---------------------------------------------------------------
	t.Run("Account_Register_AgentA", func(t *testing.T) {})

	agentAUser := uniqueName("gotest_a")
	regResultA, err := apiClient.IM().Account.Register(ctx, &prismer.IMRegisterOptions{
		Type:         "agent",
		Username:     agentAUser,
		DisplayName:  fmt.Sprintf("Go Test Agent A %d", ts),
		AgentType:    "assistant",
		Capabilities: []string{"chat", "testing"},
		Description:  "Integration test agent A",
	})
	if err != nil {
		t.Fatalf("Register agent A error: %v", err)
	}
	if !regResultA.OK {
		t.Fatalf("Register agent A not OK: %+v", regResultA.Error)
	}

	var regDataA prismer.IMRegisterData
	if err := regResultA.Decode(&regDataA); err != nil {
		t.Fatalf("Decode register A data: %v", err)
	}
	if regDataA.Token == "" {
		t.Fatal("expected non-empty Token for agent A")
	}
	t.Logf("Agent A registered — userId=%s username=%s isNew=%v",
		regDataA.IMUserID, regDataA.Username, regDataA.IsNew)

	agentAId := regDataA.IMUserID

	// Create authenticated client for agent A
	imClientA := prismer.NewClient(regDataA.Token, prismer.WithEnvironment(prismer.Production))

	// ---------------------------------------------------------------
	// 3.2  Register agent B (target)
	// ---------------------------------------------------------------
	agentBUser := uniqueName("gotest_b")
	regResultB, err := apiClient.IM().Account.Register(ctx, &prismer.IMRegisterOptions{
		Type:         "agent",
		Username:     agentBUser,
		DisplayName:  fmt.Sprintf("Go Test Agent B %d", ts),
		AgentType:    "assistant",
		Capabilities: []string{"chat"},
		Description:  "Integration test agent B",
	})
	if err != nil {
		t.Fatalf("Register agent B error: %v", err)
	}
	if !regResultB.OK {
		t.Fatalf("Register agent B not OK: %+v", regResultB.Error)
	}

	var regDataB prismer.IMRegisterData
	if err := regResultB.Decode(&regDataB); err != nil {
		t.Fatalf("Decode register B data: %v", err)
	}
	if regDataB.Token == "" {
		t.Fatal("expected non-empty Token for agent B")
	}
	t.Logf("Agent B registered — userId=%s username=%s isNew=%v",
		regDataB.IMUserID, regDataB.Username, regDataB.IsNew)

	targetId := regDataB.IMUserID
	_ = agentAId // may be used later

	// ---------------------------------------------------------------
	// 3.3  Account.Me
	// ---------------------------------------------------------------
	t.Run("Account_Me", func(t *testing.T) {
		meResult, err := imClientA.IM().Account.Me(ctx)
		if err != nil {
			t.Fatalf("Me error: %v", err)
		}
		if !meResult.OK {
			t.Fatalf("Me not OK: %+v", meResult.Error)
		}

		var meData prismer.IMMeData
		if err := meResult.Decode(&meData); err != nil {
			t.Fatalf("Decode Me data: %v", err)
		}
		if meData.User.Username != agentAUser {
			t.Errorf("expected username=%s, got %s", agentAUser, meData.User.Username)
		}
		t.Logf("Me — user=%s role=%s stats=%+v",
			meData.User.Username, meData.User.Role, meData.Stats)
	})

	// ---------------------------------------------------------------
	// 3.4  Account.RefreshToken
	// ---------------------------------------------------------------
	t.Run("Account_RefreshToken", func(t *testing.T) {
		refreshResult, err := imClientA.IM().Account.RefreshToken(ctx)
		if err != nil {
			t.Fatalf("RefreshToken error: %v", err)
		}
		if !refreshResult.OK {
			t.Fatalf("RefreshToken not OK: %+v", refreshResult.Error)
		}

		var tokenData prismer.IMTokenData
		if err := refreshResult.Decode(&tokenData); err != nil {
			t.Fatalf("Decode token data: %v", err)
		}
		if tokenData.Token == "" {
			t.Error("expected non-empty refreshed token")
		}
		t.Logf("RefreshToken — expiresIn=%s tokenLen=%d",
			tokenData.ExpiresIn, len(tokenData.Token))
	})

	// ---------------------------------------------------------------
	// 3.5  Direct Messaging
	// ---------------------------------------------------------------
	t.Run("Direct_Send", func(t *testing.T) {
		sendResult, err := imClientA.IM().Direct.Send(ctx, targetId, "Hello from Go integration test!", nil)
		if err != nil {
			t.Fatalf("Direct.Send error: %v", err)
		}
		if !sendResult.OK {
			t.Fatalf("Direct.Send not OK: %+v", sendResult.Error)
		}
		t.Logf("Direct.Send — ok=%v", sendResult.OK)
	})

	t.Run("Direct_GetMessages", func(t *testing.T) {
		msgsResult, err := imClientA.IM().Direct.GetMessages(ctx, targetId, nil)
		if err != nil {
			t.Fatalf("Direct.GetMessages error: %v", err)
		}
		if !msgsResult.OK {
			t.Fatalf("Direct.GetMessages not OK: %+v", msgsResult.Error)
		}

		// SDK BUG: IMMessage.Metadata is map[string]any but API returns string.
		// Use imMessageLoose to work around.
		var messages []imMessageLoose
		if err := msgsResult.Decode(&messages); err != nil {
			t.Fatalf("Decode messages: %v", err)
		}
		if len(messages) == 0 {
			t.Error("expected at least one message")
		} else {
			t.Logf("Direct.GetMessages — count=%d firstContent=%q",
				len(messages), messages[0].Content)
		}
	})

	// ---------------------------------------------------------------
	// 3.6  Credits
	// ---------------------------------------------------------------
	t.Run("Credits_Get", func(t *testing.T) {
		creditsResult, err := imClientA.IM().Credits.Get(ctx)
		if err != nil {
			t.Fatalf("Credits.Get error: %v", err)
		}
		if !creditsResult.OK {
			t.Fatalf("Credits.Get not OK: %+v", creditsResult.Error)
		}

		var creditsData prismer.IMCreditsData
		if err := creditsResult.Decode(&creditsData); err != nil {
			t.Fatalf("Decode credits data: %v", err)
		}
		t.Logf("Credits.Get — balance=%.2f totalEarned=%.2f totalSpent=%.2f",
			creditsData.Balance, creditsData.TotalEarned, creditsData.TotalSpent)
	})

	t.Run("Credits_Transactions", func(t *testing.T) {
		txResult, err := imClientA.IM().Credits.Transactions(ctx, nil)
		if err != nil {
			t.Fatalf("Credits.Transactions error: %v", err)
		}
		if !txResult.OK {
			t.Fatalf("Credits.Transactions not OK: %+v", txResult.Error)
		}

		var transactions []prismer.IMTransaction
		if err := txResult.Decode(&transactions); err != nil {
			t.Fatalf("Decode transactions: %v", err)
		}
		t.Logf("Credits.Transactions — count=%d", len(transactions))
	})

	// ---------------------------------------------------------------
	// 3.7  Contacts & Discovery
	// ---------------------------------------------------------------
	t.Run("Contacts_List", func(t *testing.T) {
		contactsResult, err := imClientA.IM().Contacts.List(ctx)
		if err != nil {
			t.Fatalf("Contacts.List error: %v", err)
		}
		if !contactsResult.OK {
			t.Fatalf("Contacts.List not OK: %+v", contactsResult.Error)
		}

		var contacts []prismer.IMContact
		if err := contactsResult.Decode(&contacts); err != nil {
			t.Fatalf("Decode contacts: %v", err)
		}
		t.Logf("Contacts.List — count=%d", len(contacts))
	})

	t.Run("Contacts_Discover", func(t *testing.T) {
		discoverResult, err := imClientA.IM().Contacts.Discover(ctx, nil)
		if err != nil {
			t.Fatalf("Contacts.Discover error: %v", err)
		}
		if !discoverResult.OK {
			t.Fatalf("Contacts.Discover not OK: %+v", discoverResult.Error)
		}

		var agents []prismer.IMDiscoverAgent
		if err := discoverResult.Decode(&agents); err != nil {
			t.Fatalf("Decode discover agents: %v", err)
		}
		t.Logf("Contacts.Discover — count=%d", len(agents))
	})

	// ---------------------------------------------------------------
	// 3.8  Groups
	// ---------------------------------------------------------------
	var groupId string

	t.Run("Groups_Create", func(t *testing.T) {
		createResult, err := imClientA.IM().Groups.Create(ctx, &prismer.IMCreateGroupOptions{
			Title:       fmt.Sprintf("Go Integration Group %d", ts),
			Description: "Test group created by Go integration tests",
			Members:     []string{targetId},
		})
		if err != nil {
			t.Fatalf("Groups.Create error: %v", err)
		}
		if !createResult.OK {
			t.Fatalf("Groups.Create not OK: %+v", createResult.Error)
		}

		var groupData prismer.IMGroupData
		if err := createResult.Decode(&groupData); err != nil {
			t.Fatalf("Decode group data: %v", err)
		}
		if groupData.GroupID == "" {
			t.Fatal("expected non-empty groupId")
		}
		groupId = groupData.GroupID
		t.Logf("Groups.Create — groupId=%s title=%s members=%d",
			groupData.GroupID, groupData.Title, len(groupData.Members))
	})

	t.Run("Groups_List", func(t *testing.T) {
		if groupId == "" {
			t.Skip("no group created")
		}
		listResult, err := imClientA.IM().Groups.List(ctx)
		if err != nil {
			t.Fatalf("Groups.List error: %v", err)
		}
		if !listResult.OK {
			t.Fatalf("Groups.List not OK: %+v", listResult.Error)
		}

		var groups []prismer.IMGroupData
		if err := listResult.Decode(&groups); err != nil {
			t.Fatalf("Decode groups: %v", err)
		}
		if len(groups) == 0 {
			t.Error("expected at least one group")
		}
		t.Logf("Groups.List — count=%d", len(groups))
	})

	t.Run("Groups_Get", func(t *testing.T) {
		if groupId == "" {
			t.Skip("no group created")
		}
		getResult, err := imClientA.IM().Groups.Get(ctx, groupId)
		if err != nil {
			t.Fatalf("Groups.Get error: %v", err)
		}
		if !getResult.OK {
			t.Fatalf("Groups.Get not OK: %+v", getResult.Error)
		}

		var groupData prismer.IMGroupData
		if err := getResult.Decode(&groupData); err != nil {
			t.Fatalf("Decode group data: %v", err)
		}
		if groupData.GroupID != groupId {
			t.Errorf("expected groupId=%s, got %s", groupId, groupData.GroupID)
		}
		t.Logf("Groups.Get — groupId=%s title=%s", groupData.GroupID, groupData.Title)
	})

	t.Run("Groups_Send", func(t *testing.T) {
		if groupId == "" {
			t.Skip("no group created")
		}
		sendResult, err := imClientA.IM().Groups.Send(ctx, groupId, "Hello group from Go integration test!", nil)
		if err != nil {
			t.Fatalf("Groups.Send error: %v", err)
		}
		if !sendResult.OK {
			t.Fatalf("Groups.Send not OK: %+v", sendResult.Error)
		}
		t.Logf("Groups.Send — ok=%v", sendResult.OK)
	})

	t.Run("Groups_GetMessages", func(t *testing.T) {
		if groupId == "" {
			t.Skip("no group created")
		}
		msgsResult, err := imClientA.IM().Groups.GetMessages(ctx, groupId, nil)
		if err != nil {
			t.Fatalf("Groups.GetMessages error: %v", err)
		}
		if !msgsResult.OK {
			t.Fatalf("Groups.GetMessages not OK: %+v", msgsResult.Error)
		}

		// SDK BUG: IMMessage.Metadata is map[string]any but API returns string.
		// Use imMessageLoose to work around.
		var messages []imMessageLoose
		if err := msgsResult.Decode(&messages); err != nil {
			t.Fatalf("Decode group messages: %v", err)
		}
		if len(messages) == 0 {
			t.Error("expected at least one group message")
		} else {
			t.Logf("Groups.GetMessages — count=%d firstContent=%q",
				len(messages), messages[0].Content)
		}
	})

	// ---------------------------------------------------------------
	// 3.9  Conversations
	// ---------------------------------------------------------------
	t.Run("Conversations_List", func(t *testing.T) {
		convResult, err := imClientA.IM().Conversations.List(ctx, false, false)
		if err != nil {
			t.Fatalf("Conversations.List error: %v", err)
		}
		if !convResult.OK {
			t.Fatalf("Conversations.List not OK: %+v", convResult.Error)
		}

		var conversations []prismer.IMConversation
		if err := convResult.Decode(&conversations); err != nil {
			t.Fatalf("Decode conversations: %v", err)
		}
		t.Logf("Conversations.List — count=%d", len(conversations))
	})
}
