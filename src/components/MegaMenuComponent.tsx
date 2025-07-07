import * as React from 'react';
import styles from './MainMenu.module.scss';
import { HttpClient, HttpClientResponse } from '@microsoft/sp-http';

export interface MenuItem {
  title: string;
  href: string;
}

export interface MenuColumn {
  title: string;
  items: MenuItem[];
}

export interface MegaMenuData {
  columns: MenuColumn[];
}

export interface NavigationItem {
  title: string;
  href: string;
  megaMenu?: MegaMenuData;
}

export interface SiteCollectionItem {
  Text: string;
  Value: string;
}

export interface IMegaMenuComponentProps {
  siteUrl: string;
  httpClient: HttpClient;
}

export interface IMegaMenuComponentState {
  activeMenu: string | null;
  isMobileMenuOpen: boolean;
  activeMobileSubmenu: string | null;
  menuData: NavigationItem[];
  siteCollectionList: SiteCollectionItem[];
}

export default class MegaMenuComponent extends React.Component<IMegaMenuComponentProps, IMegaMenuComponentState> {
  private timeoutRef: number | null = null;

  constructor(props: IMegaMenuComponentProps) {
    super(props);
    this.state = {
      activeMenu: null,
      isMobileMenuOpen: false,
      activeMobileSubmenu: null,
      menuData: [],
      siteCollectionList: []
    };
  }

  public componentDidMount(): void {
    this.loadMenuData();
  }

  private loadMenuData = async (): Promise<void> => {
    try {
      // Load both data sources in parallel
      await Promise.all([
        this.getSiteCollections(),
        this.getMenuJsonData()
      ]);
    } catch (error) {
      console.error("Error loading menu data:", error);
    }
  }

  private getSiteCollections = async (): Promise<void> => {
    try {
      const response: HttpClientResponse = await this.props.httpClient.get(
        `${this.props.siteUrl}/_layouts/15/FLS_Claims/applicationpage1.aspx/GetSiteCollections`,
        HttpClient.configurations.v1,
        {
          headers: {
            'Accept': 'application/json',
            'Content-type': 'application/json; charset=UTF-8'
          }
        }
      );

      const json = await response.json();
      console.log('Site Collections:', json.d);

      this.setState({
        siteCollectionList: json.d || []
      });
    } catch (error) {
      console.error("Error fetching site collections:", error);
      this.setState({ siteCollectionList: [] });
    }
  }

  private getMenuJsonData = async (): Promise<void> => {
    try {
      // Fetch the menuData.txt file from SharePoint document library
      const url = `${this.props.siteUrl}/SiteAssets/menuData.txt`;
      
      const response: HttpClientResponse = await this.props.httpClient.get(
        url,
        HttpClient.configurations.v1,
        {
          headers: {
            'Accept': 'text/plain',
            'Content-type': 'text/plain; charset=UTF-8'
          }
        }
      );
      
      // Get the text content and parse as JSON
      const textData = await response.text();
      const data = JSON.parse(textData);
      
      console.log('Menu Data from SharePoint:', data);
      this.setState({ menuData: data.navigation || [] });
    } catch (error) {
      console.error("Failed to fetch menu data from SharePoint:", error);
      this.setState({ menuData: [] });
    }
  }

  private createMySitesFromSiteCollection = (): MegaMenuData => {
    const { siteCollectionList } = this.state;
    
    if (!siteCollectionList || siteCollectionList.length === 0) {
      return { columns: [] };
    }

    // Filter out invalid items and sort sites alphabetically by text
    const validSites = siteCollectionList.filter(site => 
      site && 
      typeof site.Text === 'string' && 
      typeof site.Value === 'string' &&
      site.Text.trim() !== '' &&
      site.Value.trim() !== ''
    );

    const sortedSites = validSites.sort((a, b) => {
      // Additional safety check
      if (!a || !b || !a.Text || !b.Text) {
        return 0;
      }
      return a.Text.localeCompare(b.Text);
    });

    // Calculate items per column for 4 columns
    const totalItems = sortedSites.length;
    const columnsCount = 4;
    const itemsPerColumn = Math.ceil(totalItems / columnsCount);

    // Create 4 columns
    const columns: MenuColumn[] = [];
    
    for (let i = 0; i < columnsCount; i++) {
      const startIndex = i * itemsPerColumn;
      const endIndex = Math.min(startIndex + itemsPerColumn, totalItems);
      const columnItems = sortedSites.slice(startIndex, endIndex);

      if (columnItems.length > 0) {
        columns.push({
          title: "", // Empty title as per your original design
          items: columnItems.map(site => ({
            title: site.Text,
            href: site.Value
          }))
        });
      }
    }

    return { columns };
  }

  private getProcessedNavigation = (): NavigationItem[] => {
    const { menuData } = this.state;
    
    if (!menuData || menuData.length === 0) {
      return [];
    }

    // Process navigation items
    return menuData.map(item => {
      // If this is "My Sites", replace its megaMenu with site collection data
      if (item.title === "My Sites") {
        return {
          ...item,
          megaMenu: this.createMySitesFromSiteCollection()
        };
      }
      
      // For all other items, return as-is
      return item;
    });
  }

  private handleMouseEnter = (title: string, hasMegaMenu: boolean): void => {
    if (window.innerWidth >= 768 && hasMegaMenu) {
      if (this.timeoutRef) {
        clearTimeout(this.timeoutRef);
      }
      this.setState({ activeMenu: title });
    }
  }

  private handleMouseLeave = (): void => {
    if (window.innerWidth >= 768) {
      this.timeoutRef = window.setTimeout(() => {
        this.setState({ activeMenu: null });
      }, 150);
    }
  }

  private toggleMobileSubmenu = (title: string): void => {
    this.setState((prevState) => ({
      activeMobileSubmenu: prevState.activeMobileSubmenu === title ? null : title
    }));
  }

  private toggleMobileMenu = (): void => {
    this.setState((prevState) => ({
      isMobileMenuOpen: !prevState.isMobileMenuOpen
    }));
  }

  public componentWillUnmount(): void {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
    }
  }

  public render(): React.ReactElement<{}> {
    const { activeMenu, isMobileMenuOpen, activeMobileSubmenu } = this.state;
    
    // Get processed navigation with hybrid data
    const navigation = this.getProcessedNavigation();

    return (
      <nav className={styles.megaMenu}>
        <div className={styles.container}>
          <div className={styles.header}>
            {/* Desktop Navigation */}
            <div className={styles.desktopNav}>
              {navigation.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  className={styles.navItem}
                  onMouseEnter={() => this.handleMouseEnter(item.title, !!item.megaMenu)}
                  onMouseLeave={this.handleMouseLeave}
                >
                  {item.megaMenu ? (
                    <button className={styles.navButton}>
                      <span>{item.title}</span>
                      <span className={styles.chevron}></span>
                    </button>
                  ) : (
                    <a
                      href={item.href}
                      className={styles.navLink}
                    >
                      <span>{item.title}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <div className={styles.mobileMenuButton}>
              <button
                onClick={this.toggleMobileMenu}
                className={styles.hamburger}
                aria-label="Main menu"
              >
                {isMobileMenuOpen ? '✕' : '☰'}
              </button>
            </div>
          </div>

          {/* Desktop Mega Menu Dropdown */}
          {activeMenu && (
            <div
              className={styles.megaMenuDropdown}
              onMouseEnter={() => {
                if (this.timeoutRef) {
                  clearTimeout(this.timeoutRef);
                }
              }}
              onMouseLeave={this.handleMouseLeave}
            >
              <div className={styles.dropdownContent}>
                {navigation.map((item) => {
                  if (item.title === activeMenu && item.megaMenu) {
                    return (
                      <div key={item.title} className={styles.columnsGrid}>
                        {item.megaMenu.columns.map((column, columnIndex) => (
                          <div key={columnIndex} className={styles.column}>
                            <h3 className={styles.columnTitle}>
                              {column.title}
                            </h3>
                            <ul className={styles.columnList}>
                              {column.items.map((menuItem, itemIndex) => (
                                <li key={itemIndex}>
                                  <a
                                    href={menuItem.href}
                                    className={styles.columnLink}
                                  >
                                    {menuItem.title}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className={styles.mobileMenu}>
            <div className={styles.mobileMenuContent}>
              {navigation.map((item, index) => (
                <div key={`${item.title}-${index}`}>
                  {item.megaMenu ? (
                    <div>
                      <button
                        onClick={() => this.toggleMobileSubmenu(item.title)}
                        className={styles.mobileNavButton}
                      >
                        <span>{item.title}</span>
                        <span className={`${styles.mobileChevron} ${activeMobileSubmenu === item.title ? styles.rotated : ''}`}>
                        </span>
                      </button>
                      {activeMobileSubmenu === item.title && (
                        <div className={styles.mobileSubmenu}>
                          {item.megaMenu.columns.map((column, columnIndex) => (
                            <div key={columnIndex} className={styles.mobileColumn}>
                              <h4 className={styles.mobileColumnTitle}>
                                {column.title}
                              </h4>
                              {column.items.map((menuItem, itemIndex) => (
                                <a
                                  key={itemIndex}
                                  href={menuItem.href}
                                  className={styles.mobileColumnLink}
                                >
                                  {menuItem.title}
                                </a>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <a
                      href={item.href}
                      className={styles.mobileNavLink}
                    >
                      {item.title}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>
    );
  }
}