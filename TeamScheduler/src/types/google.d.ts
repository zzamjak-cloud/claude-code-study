// Google API 타입 정의

declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenClient {
        requestAccessToken: (options?: { prompt?: string }) => void
      }

      interface TokenResponse {
        access_token: string
        error?: string
        expires_in: number
        scope: string
        token_type: string
      }

      function initTokenClient(config: {
        client_id: string
        scope: string
        callback: (response: TokenResponse) => void
      }): TokenClient

      function revoke(accessToken: string, callback?: () => void): void
    }
  }
}

declare namespace gapi {
  function load(apiName: string, callback: () => void): void

  namespace client {
    function init(config: {
      apiKey?: string
      discoveryDocs?: string[]
    }): Promise<void>

    function getToken(): { access_token: string } | null
    function setToken(token: null): void

    namespace calendar {
      namespace events {
        function list(params: {
          calendarId: string
          timeMin?: string
          timeMax?: string
          showDeleted?: boolean
          singleEvents?: boolean
          orderBy?: string
          maxResults?: number
        }): Promise<{
          result: {
            items?: Array<{
              id: string
              summary: string
              start: {
                dateTime?: string
                date?: string
              }
              end: {
                dateTime?: string
                date?: string
              }
              htmlLink?: string
            }>
          }
        }>
      }
    }
  }
}
