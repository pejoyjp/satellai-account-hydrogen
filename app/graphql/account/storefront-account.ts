import { gql } from "@shopify/hydrogen";
export const MULTIPASS_LOGIN = gql(`
  mutation AccountMultipassLogin($token: String!) {
    customerAccessTokenCreateWithMultipass(multipassToken: $token) {
      customerAccessToken { accessToken expiresAt }
      customerUserErrors { code message }
    }
  }
`);
export const CUSTOMER_DASHBOARD = gql(`
  query CustomerDashboard($token: String!, $first: Int, $after: String, $last: Int, $before: String) {
    customer(customerAccessToken: $token) {
      id firstName lastName email phone
      defaultAddress { id }
      addresses(first: 100) {
        nodes { id firstName lastName company address1 address2 city province country zip phone }
      }
      orders(first: $first, after: $after, last: $last, before: $before, reverse: true, sortKey: PROCESSED_AT) {
        totalCount
        nodes {
          id name processedAt financialStatus fulfillmentStatus statusUrl
          subtotalPrice { amount currencyCode }
          totalShippingPrice { amount currencyCode }
          totalTax { amount currencyCode }
          totalPrice { amount currencyCode }
          lineItems(first: 50) {
            nodes {
              title quantity
              originalTotalPrice { amount currencyCode }
              variant { title image { url altText width height } }
            }
          }
        }
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      }
    }
  }
`);
export const CUSTOMER_UPDATE = gql(`
  mutation AccountCustomerUpdate($token: String!, $customer: CustomerUpdateInput!) {
    customerUpdate(customerAccessToken: $token, customer: $customer) {
      customer { id }
      customerUserErrors { code message }
    }
  }
`);
export const ADDRESS_CREATE = gql(`
  mutation AccountAddressCreate($token: String!, $address: MailingAddressInput!) {
    customerAddressCreate(customerAccessToken: $token, address: $address) {
      customerAddress { id } customerUserErrors { code message }
    }
  }
`);
export const ADDRESS_UPDATE = gql(`
  mutation AccountAddressUpdate($token: String!, $id: ID!, $address: MailingAddressInput!) {
    customerAddressUpdate(customerAccessToken: $token, id: $id, address: $address) {
      customerAddress { id } customerUserErrors { code message }
    }
  }
`);
export const ADDRESS_DELETE = gql(`
  mutation AccountAddressDelete($token: String!, $id: ID!) {
    customerAddressDelete(customerAccessToken: $token, id: $id) {
      deletedCustomerAddressId customerUserErrors { code message }
    }
  }
`);
export const ADDRESS_DEFAULT = gql(`
  mutation AccountDefaultAddress($token: String!, $id: ID!) {
    customerDefaultAddressUpdate(customerAccessToken: $token, addressId: $id) {
      customer { id } customerUserErrors { code message }
    }
  }
`);
export const CUSTOMER_LOGOUT = gql(`
  mutation AccountCustomerLogout($token: String!) {
    customerAccessTokenDelete(customerAccessToken: $token) { deletedAccessToken userErrors { message } }
  }
`);
